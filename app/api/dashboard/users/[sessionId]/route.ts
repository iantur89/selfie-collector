import { NextRequest, NextResponse } from 'next/server'
import { getUserSessionDetail } from '@server/admin/dashboard'

type RouteParams = {
  params: Promise<{ sessionId: string }>
}

export async function GET(_request: NextRequest, context: RouteParams) {
  try {
    const { sessionId } = await context.params
    const detail = await getUserSessionDetail(sessionId)
    return NextResponse.json({
      status: 'success',
      ...detail,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
