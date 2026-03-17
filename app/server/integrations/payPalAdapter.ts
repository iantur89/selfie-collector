import { randomUUID } from 'node:crypto'
import { CreatePayPalCheckoutInputSchema, CreatePayPalCheckoutOutputSchema } from '../../contracts/tools'
import { env } from '../config/env'

export async function createPayPalCheckout(input: unknown) {
  const parsed = CreatePayPalCheckoutInputSchema.parse(input)
  const transactionId = randomUUID()
  const checkoutUrl = `${env.payPalBaseUrl.replace(/\/$/, '')}?token=${transactionId}&amt=${parsed.amount}&cur=${parsed.currency}`

  return CreatePayPalCheckoutOutputSchema.parse({
    status: 'success',
    checkoutUrl,
    transactionId,
  })
}
