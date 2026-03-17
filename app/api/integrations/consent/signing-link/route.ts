import { NextRequest, NextResponse } from 'next/server'
import { createSigningLink } from '@server/integrations/docuSealAdapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await createSigningLink(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
