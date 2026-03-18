import { randomUUID } from 'node:crypto'
import { logA3In, logA3Out, logTelegramPhoto, logTelegramUnsupported } from '../a3/log'
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
async function downloadTelegramPhoto(fileId: string, sessionId: string): Promise<Buffer | null> {
  const token = env.telegramBotToken
  console.log('[TelegramDownload] called', { sessionId, fileId, tokenPresent: Boolean(token) })
  if (!token) {
    console.error('[TelegramDownload] missing TELEGRAM_BOT_TOKEN')
    return null
  }

  try {
    const getFileRes = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    )
    console.log('[TelegramDownload] getFile response', {
      sessionId,
      ok: getFileRes.ok,
      status: getFileRes.status,
      statusText: getFileRes.statusText,
    })
    const getFileJson = await getFileRes
      .json()
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[TelegramDownload] getFile JSON parse error', { sessionId, message })
        return null
      })
    const filePath = getFileJson?.result?.file_path as string | undefined
    console.log('[TelegramDownload] getFile json', {
      sessionId,
      ok: getFileJson?.ok,
      hasResult: Boolean(getFileJson?.result),
      hasFilePath: Boolean(filePath),
      filePath,
    })
    if (!filePath) return null

    // Telegram downloads use: https://api.telegram.org/file/bot<token>/<file_path>
    const fileUrl = `${TELEGRAM_API_BASE}/file/bot${token}/${filePath}`
    const fileRes = await fetch(fileUrl)
    console.log('[TelegramDownload] file download response', {
      sessionId,
      ok: fileRes.ok,
      status: fileRes.status,
      statusText: fileRes.statusText,
    })
    if (!fileRes.ok) {
      // Error bodies tend to be small text/JSON; log a snippet for debugging.
      let errorBody = ''
      try {
        errorBody = await fileRes.text()
      } catch {
        errorBody = ''
      }
      console.error('[TelegramDownload] file download failed', {
        sessionId,
        status: fileRes.status,
        statusText: fileRes.statusText,
        errorBodySnippet: errorBody ? errorBody.slice(0, 500) : '(empty)',
      })
      return null
    }
    const arrayBuffer = await fileRes.arrayBuffer()
    console.log('[TelegramDownload] downloaded bytes', { sessionId, bytes: arrayBuffer.byteLength })
    return Buffer.from(arrayBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[TelegramDownload] error', { sessionId, message, stack: err instanceof Error ? err.stack : undefined })
    return null
  }
}

/** Persist Telegram photo to S3 when bucket and token are set. Returns true if uploaded (or skipped because no bucket). */
async function persistTelegramPhotoToS3(artifactKey: string, photoBytes: Buffer): Promise<boolean> {
  const bucket = env.s3Bucket
  if (!bucket || bucket === 'memory') {
    console.error('[TelegramS3] skipped upload: missing/invalid S3 bucket', { bucket: bucket ?? null, artifactKey })
    return false
  }

  console.log('[TelegramS3] persistTelegramPhotoToS3 called', {
    bucket,
    artifactKey,
    bytes: photoBytes.byteLength,
  })
  try {
    await persistArtifact({
      bucket,
      key: artifactKey,
      contentType: 'image/jpeg',
      bytesBase64: photoBytes.toString('base64'),
      metadata: {},
    })
    console.log('[TelegramS3] upload success', { bucket, artifactKey })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[TelegramS3] upload failed', { bucket, artifactKey, message, stack: err instanceof Error ? err.stack : undefined })
    return false
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<string> {
  const message = update.message
  if (!message) {
    logTelegramUnsupported('unknown', 'No message payload')
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

  const incomingSummary = message.photo?.length
    ? `User sent an image. fileId: ${message.photo[message.photo.length - 1].file_id}`
    : (message.text ?? message.caption ?? '(no text)')
  logA3In(sessionId, incomingSummary)

  if (message.photo && message.photo.length > 0) {
    const photoFileId = message.photo[message.photo.length - 1].file_id
    const artifactKey = `prod/${userId}/${sessionId}/telegram/${Date.now()}-${photoFileId}.jpg`
    const stage = state?.workflowStage ?? 'onboarding_orchestrator'
    // Accept photos when ID-verify agent is active (orchestrator may have transitioned but not set workflowStage in state)
    const isIdVerifyFlow =
      stage === 'id_verify_agent' || sessionData?.activeAgentId === 'id_verify_agent'

    const photoBranch = isIdVerifyFlow
      ? !state?.idImageS3Key
        ? 'id_verify_first'
        : 'id_verify_selfie'
      : stage === 'ingest_agent'
        ? 'ingest'
        : 'unhandled'
    logTelegramPhoto(sessionId, `${stage}(active=${sessionData?.activeAgentId ?? 'null'})`, photoBranch)

    const photoBytes = await downloadTelegramPhoto(photoFileId, sessionId)
    if (!photoBytes) {
      logTelegramUnsupported(sessionId, 'Failed to download Telegram photo; skipping verification')
      const reply = 'I could not download your photo from Telegram. Please try sending it again.'
      logA3Out(sessionId, reply, state as Record<string, unknown>)
      return reply
    }

    const persisted = await persistTelegramPhotoToS3(artifactKey, photoBytes)
    if (!persisted) {
      logTelegramUnsupported(sessionId, 'Failed to persist Telegram photo to S3; skipping verification')
      const reply = 'I received your photo, but I could not store it. Please try again.'
      logA3Out(sessionId, reply, state as Record<string, unknown>)
      return reply
    }

    if (isIdVerifyFlow) {
      if (!state?.idImageS3Key) {
        await updateSessionState(
          sessionId,
          (current) => ({
            ...current,
            telegramChatId: String(chatId),
            telegramUserId: userId,
            idImageS3Key: artifactKey,
            workflowStage: 'id_verify_agent',
            verificationAttempts: current.verificationAttempts + 1,
          }),
          'id_verify_agent',
        )
        const reply = 'ID image received. Please upload your selfie now.'
        logA3Out(sessionId, reply, { ...state, idImageS3Key: artifactKey, workflowStage: 'id_verify_agent' })
        return reply
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
      const reply =
        verify.outcome === 'verified' && match.matched
          ? 'Identity verified. We can now continue with consent.'
          : 'Verification was not successful. Please retry with clearer images.'
      logA3Out(sessionId, reply, {
        ...state,
        selfieImageS3Key: artifactKey,
        selfieVerified: verify.outcome === 'verified',
        idVerified: verify.outcome === 'verified',
        faceMatched: match.matched,
        verificationStatus: verify.outcome,
        workflowStage: verify.outcome === 'verified' && match.matched ? 'consent_agent' : 'id_verify_agent',
      })
      return reply
    }

    if (stage === 'ingest_agent') {
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
      const reply = 'Photo received for ingest.'
      logA3Out(sessionId, reply, state as Record<string, unknown>)
      return reply
    }
  }

  const text = message.text ?? message.caption ?? ''
  if (!text) {
    logTelegramUnsupported(sessionId, 'No text or caption and photo not handled in current stage')
    const reply = 'Unsupported message type. Please send text or image.'
    logA3Out(sessionId, reply, state as Record<string, unknown>)
    return reply
  }

  const result = await session.send(text)
  logA3Out(sessionId, result.responseMessage, result.state as Record<string, unknown>)
  return result.responseMessage
}
