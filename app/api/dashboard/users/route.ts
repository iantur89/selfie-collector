import { NextRequest, NextResponse } from 'next/server'
import { listUserSessions } from '@server/admin/dashboard'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('q') ?? undefined
    const users = await listUserSessions(search)
    return NextResponse.json({
      status: 'success',
      items: users,
      total: users.length,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
