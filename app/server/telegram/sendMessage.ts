import { env } from '@server/config/env'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

/**
 * Send a text message to a Telegram chat. No-op if token or text is missing.
 */
export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = env.telegramBotToken
  if (!token || !text) return
  await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}
