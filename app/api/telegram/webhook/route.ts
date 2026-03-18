import { NextRequest, NextResponse } from 'next/server'
import { getIdempotencyStore } from '@server/idempotency/store'
import { handleTelegramUpdate } from '@server/telegram/handler'
import { sendTelegramMessage } from '@server/telegram/sendMessage'

export async function POST(request: NextRequest) {
  try {
    const update = await request.json()
    const updateId = String(update.update_id ?? '')
    if (!updateId) {
      return NextResponse.json({ error: 'Missing update_id' }, { status: 400 })
    }

    const idempotencyStore = getIdempotencyStore()
    if (await idempotencyStore.has('telegram_update', updateId)) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    await idempotencyStore.mark('telegram_update', updateId)

    const responseMessage = await handleTelegramUpdate(update)
    const chatId = update.message?.chat?.id ?? update.message?.from?.id
    if (chatId != null && responseMessage) {
      await sendTelegramMessage(chatId, responseMessage)
    }
    return NextResponse.json({ ok: true, responseMessage })
  } catch (error) {
    console.error('[telegram webhook]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
