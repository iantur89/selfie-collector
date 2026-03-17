import { NextRequest, NextResponse } from 'next/server'
import { tagSelfie } from '@server/integrations/enrichmentAdapter'
import { drainInMemoryEnrichmentQueue, EnrichmentJob } from '@server/queue/enrichmentQueue'
import { createCollectorSession, updateSessionState } from '@server/a3/session'
import { upsertDatasetRecord } from '@server/metadata/repository'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const jobs = Array.isArray(body?.jobs) ? (body.jobs as EnrichmentJob[]) : drainInMemoryEnrichmentQueue()

  const results = await Promise.all(
    jobs.map(async (job) => {
      const session = createCollectorSession(job.sessionId)
      const sessionData = await session.getSessionData()
      const currentState = sessionData?.state

      const enriched = await tagSelfie({
        sessionId: job.sessionId,
        userId: job.userId,
        selfieS3Key: job.selfieS3Key,
      })

      await upsertDatasetRecord({
        selfieId: job.selfieId,
        sessionId: job.sessionId,
        userId: job.userId,
        s3Key: job.selfieS3Key,
        verificationStatus: currentState?.verificationStatus ?? 'pending',
        consented: currentState?.consentGiven ?? false,
        paid: currentState?.paymentCompleted ?? false,
        tags: enriched.tags,
        confidence: enriched.confidence,
        modelName: enriched.modelName,
        modelVersion: enriched.modelVersion,
        createdAt: new Date().toISOString(),
      })

      await updateSessionState(
        job.sessionId,
        (state) => ({
          ...state,
          selfieTags: [
            ...state.selfieTags,
            {
              selfieId: job.selfieId,
              angle: enriched.tags.angle,
              lighting: enriched.tags.lighting,
              gender: enriched.tags.gender,
              demographics: enriched.tags.demographics,
              quality: enriched.tags.quality,
              confidence: enriched.confidence,
              modelName: enriched.modelName,
              modelVersion: enriched.modelVersion,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
        'ingest_agent',
      )
      return { selfieId: job.selfieId, status: enriched.status }
    }),
  )

  return NextResponse.json({
    processed: results.length,
    results,
  })
}
