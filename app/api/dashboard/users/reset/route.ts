import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { deleteCollectorSession } from '@server/a3/session'
import { deleteDatasetRecordsBySession, recordAuditLog } from '@server/metadata/repository'

const ResetUserInputSchema = z.object({
  sessionId: z.string().min(1),
  actor: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ResetUserInputSchema.parse(body)
    const actor = parsed.actor ?? 'admin'

    await deleteCollectorSession(parsed.sessionId)
    const deletedDatasetRows = await deleteDatasetRecordsBySession(parsed.sessionId)

    await recordAuditLog('dashboard.user_reset', actor, {
      sessionId: parsed.sessionId,
      deletedDatasetRows,
    })

    return NextResponse.json({
      status: 'success',
      sessionId: parsed.sessionId,
      deletedDatasetRows,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
