import crypto from 'node:crypto'

export function verifyHmacSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) {
    return false
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const normalizedSignature = signature.replace(/^sha256=/, '')

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(normalizedSignature)

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}
