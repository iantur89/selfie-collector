import { NextRequest, NextResponse } from 'next/server'
import { faceMatch } from '@server/integrations/identityAdapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await faceMatch(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
