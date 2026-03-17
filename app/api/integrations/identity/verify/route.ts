import { NextRequest, NextResponse } from 'next/server'
import { verifyDocumentAndSelfie } from '@server/integrations/identityAdapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await verifyDocumentAndSelfie(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
