import { NextRequest, NextResponse } from 'next/server'
import { QueryDatasetInputSchema, QueryDatasetOutputSchema } from '@contracts/tools'
import { queryDataset } from '@server/metadata/repository'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = QueryDatasetInputSchema.parse(body)
    const result = await queryDataset(parsed.filters, parsed.pagination.page, parsed.pagination.pageSize)

    return NextResponse.json(
      QueryDatasetOutputSchema.parse({
        status: 'success',
        total: result.total,
        items: result.items.map((item) => ({
          selfieId: item.selfieId,
          s3Key: item.s3Key,
          tags: item.tags ?? {},
          userId: item.userId,
          sessionId: item.sessionId,
          createdAt: item.createdAt,
        })),
      }),
    )
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
