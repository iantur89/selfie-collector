import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { updateSessionState } from '@server/a3/session'
import { persistArtifact } from '@server/storage/artifactStore'
import { validateSelfie } from '@server/integrations/ingestAdapter'
import { enqueueEnrichmentJob } from '@server/queue/enrichmentQueue'
import { env } from '@server/config/env'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    sessionId?: string
    userId?: string
    fileName?: string
    contentType?: string
    bytesBase64?: string
  }

  if (!body.sessionId || !body.userId || !body.fileName || !body.bytesBase64) {
    return NextResponse.json({ error: 'sessionId, userId, fileName and bytesBase64 are required' }, { status: 400 })
  }

  const selfieId = randomUUID()
  const artifactKey = `prod/${body.userId}/${body.sessionId}/selfie/${Date.now()}-${selfieId}-${body.fileName}`
  const bucket = env.s3Bucket ?? 'memory'

  await persistArtifact({
    bucket,
    key: artifactKey,
    contentType: body.contentType ?? 'application/octet-stream',
    bytesBase64: body.bytesBase64,
    metadata: {
      sessionId: body.sessionId,
      userId: body.userId,
      selfieId,
    },
  })

  const validation = await validateSelfie({
    sessionId: body.sessionId,
    userId: body.userId,
    selfieS3Key: artifactKey,
  })

  if (!validation.accepted) {
    await updateSessionState(
      body.sessionId,
      (current) => ({
        ...current,
        rejectedSelfieIds: [...current.rejectedSelfieIds, selfieId],
      }),
      'ingest_agent',
    )
    return NextResponse.json({ accepted: false, reason: validation.reason, selfieId })
  }

  await updateSessionState(
    body.sessionId,
    (current) => ({
      ...current,
      selfieCount: current.selfieCount + 1,
      acceptedSelfieIds: [...current.acceptedSelfieIds, selfieId],
      workflowStage: 'ingest_agent',
    }),
    'ingest_agent',
  )

  await enqueueEnrichmentJob({
    sessionId: body.sessionId,
    userId: body.userId,
    selfieId,
    selfieS3Key: artifactKey,
  })

  return NextResponse.json({
    accepted: true,
    selfieId,
    artifactKey,
  })
}
