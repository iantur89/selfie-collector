import { NextRequest, NextResponse } from 'next/server'
import { createPayPalCheckout } from '@server/integrations/payPalAdapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await createPayPalCheckout(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
