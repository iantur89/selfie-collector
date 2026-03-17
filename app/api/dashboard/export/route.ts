import { NextRequest, NextResponse } from 'next/server'
import { QueryDatasetInputSchema } from '@contracts/tools'
import { queryDataset, recordAuditLog } from '@server/metadata/repository'

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
          return `"${serialized.replace(/"/g, '""')}"`
        })
        .join(','),
    ),
  ]
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = QueryDatasetInputSchema.parse(body)
    const format = body?.format === 'json' ? 'json' : 'csv'
    const actor = String(body?.actor ?? 'unknown')

    const result = await queryDataset(parsed.filters, parsed.pagination.page, parsed.pagination.pageSize)
    await recordAuditLog('dashboard.export', actor, {
      format,
      total: result.total,
      filters: parsed.filters,
    })

    if (format === 'json') {
      return NextResponse.json({ total: result.total, items: result.items })
    }

    const csv = toCsv(
      result.items.map((item) => ({
        selfieId: item.selfieId,
        sessionId: item.sessionId,
        userId: item.userId,
        s3Key: item.s3Key,
        verificationStatus: item.verificationStatus,
        consented: item.consented,
        paid: item.paid,
        tags: item.tags,
        confidence: item.confidence,
        modelName: item.modelName,
        modelVersion: item.modelVersion,
        createdAt: item.createdAt,
      })),
    )

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="dataset-export.csv"',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
