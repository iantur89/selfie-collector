import { randomUUID } from 'node:crypto'
import { registerCollectorAgents } from '../a3/registry'
import { createCollectorSession, injectSystemEvent, updateSessionState } from '../a3/session'
import { verifyDocumentAndSelfie, faceMatch } from '../integrations/identityAdapter'
import { persistArtifact } from '../storage/artifactStore'
import { env } from '../config/env'

type TelegramPhoto = {
  file_id: string
}

type TelegramMessage = {
  message_id: number
  text?: string
  caption?: string
  photo?: TelegramPhoto[]
  chat?: { id: number }
  from?: { id: number }
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
}

registerCollectorAgents()

const TELEGRAM_API_BASE = 'https://api.telegram.org'

/** Download photo bytes from Telegram by file_id. Returns null if token missing or request fails. */
async function downloadTelegramPhoto(fileId: string): Promise<Buffer | null> {
  const token = env.telegramBotToken
  if (!token) return null

  try {
    const getFileRes = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    )
    const getFileJson = (await getFileRes.json()) as { ok?: boolean; result?: { file_path?: string } }
    const filePath = getFileJson?.result?.file_path
    if (!filePath) return null

    const fileRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${filePath}`)
    if (!fileRes.ok) return null
    const arrayBuffer = await fileRes.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

/** Persist Telegram photo to S3 when bucket and token are set. Returns true if uploaded (or skipped because no bucket). */
async function persistTelegramPhotoToS3(artifactKey: string, photoBytes: Buffer): Promise<boolean> {
  const bucket = env.s3Bucket
  if (!bucket || bucket === 'memory') return false

  await persistArtifact({
    bucket,
    key: artifactKey,
    contentType: 'image/jpeg',
    bytesBase64: photoBytes.toString('base64'),
    metadata: {},
  })
  return true
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<string> {
  const message = update.message
  if (!message) {
    return 'No message payload received.'
  }

  const chatId = message.chat?.id ?? message.from?.id
  if (!chatId) {
    return 'Unable to resolve chat id.'
  }

  const sessionId = `tg-${chatId}`
  const userId = message.from?.id ? String(message.from.id) : String(chatId)
  const session = createCollectorSession(sessionId)
  const sessionData = await session.getSessionData()
  const state = sessionData?.state

  if (message.photo && message.photo.length > 0) {
    const photoFileId = message.photo[message.photo.length - 1].file_id
    const artifactKey = `prod/${userId}/${sessionId}/telegram/${Date.now()}-${photoFileId}.jpg`

    const photoBytes = await downloadTelegramPhoto(photoFileId)
    if (photoBytes) {
      await persistTelegramPhotoToS3(artifactKey, photoBytes)
    }

    if ((state?.workflowStage ?? 'onboarding_orchestrator') === 'id_verify_agent') {
      if (!state?.idImageS3Key) {
        await updateSessionState(
          sessionId,
          (current) => ({
            ...current,
            telegramChatId: String(chatId),
            telegramUserId: userId,
            idImageS3Key: artifactKey,
            verificationAttempts: current.verificationAttempts + 1,
          }),
          'id_verify_agent',
        )
        return 'ID image received. Please upload your selfie now.'
      }

      const verify = await verifyDocumentAndSelfie({
        sessionId,
        userId,
        idImageS3Key: state.idImageS3Key,
        selfieImageS3Key: artifactKey,
      })
      const match = await faceMatch({
        sessionId,
        userId,
        idImageS3Key: state.idImageS3Key,
        selfieImageS3Key: artifactKey,
      })

      await updateSessionState(
        sessionId,
        (current) => ({
          ...current,
          selfieImageS3Key: artifactKey,
          selfieVerified: verify.outcome === 'verified',
          idVerified: verify.outcome === 'verified',
          faceMatched: match.matched,
          verificationStatus: verify.outcome,
          workflowStage: verify.outcome === 'verified' && match.matched ? 'consent_agent' : 'id_verify_agent',
        }),
        'id_verify_agent',
      )

      await injectSystemEvent(sessionId, 'Identity verification was updated from Telegram upload.')
      return verify.outcome === 'verified' && match.matched
        ? 'Identity verified. We can now continue with consent.'
        : 'Verification was not successful. Please retry with clearer images.'
    }

    if ((state?.workflowStage ?? 'onboarding_orchestrator') === 'ingest_agent') {
      await updateSessionState(
        sessionId,
        (current) => ({
          ...current,
          acceptedSelfieIds: [...current.acceptedSelfieIds, randomUUID()],
          selfieCount: current.selfieCount + 1,
          workflowStage:
            current.selfieCount + 1 >= current.maxSelfiesAllowed ? 'completion_agent' : current.workflowStage,
        }),
        'ingest_agent',
      )
      return 'Photo received for ingest.'
    }
  }

  const text = message.text ?? message.caption ?? ''
  if (!text) {
    return 'Unsupported message type. Please send text or image.'
  }

  const result = await session.send(text)
  return result.responseMessage
}
