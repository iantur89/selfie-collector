import { randomUUID } from 'node:crypto'
import { CreatePayPalCheckoutInputSchema, CreatePayPalCheckoutOutputSchema } from '../../contracts/tools'
import { env } from '../config/env'

function getPayPalApiBaseUrl(): string {
  // Infer API host from checkout host if possible.
  return env.payPalBaseUrl.includes('sandbox')
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

function formatAmount(value: number): string {
  return value.toFixed(2)
}

export async function createPayPalCheckout(input: unknown) {
  const parsed = CreatePayPalCheckoutInputSchema.parse(input)
  const clientId = env.payPalClientId.trim()
  const clientSecret = env.payPalClientSecret.trim()

  // Fallback mode (no PayPal API credentials configured): deterministic mock link.
  if (!clientId || !clientSecret) {
    const transactionId = randomUUID()
    const checkoutUrl = `${env.payPalBaseUrl.replace(/\/$/, '')}?token=${transactionId}&amt=${parsed.amount}&cur=${parsed.currency}`
    return CreatePayPalCheckoutOutputSchema.parse({
      status: 'success',
      checkoutUrl,
      transactionId,
    })
  }

  const apiBaseUrl = getPayPalApiBaseUrl()
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenResponse = await fetch(`${apiBaseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text().catch(() => '')
    return CreatePayPalCheckoutOutputSchema.parse({
      status: 'retryable_error',
      checkoutUrl: '',
      transactionId: '',
      error: {
        code: 'PAYPAL_OAUTH_FAILED',
        message: `PayPal auth failed (${tokenResponse.status}). ${body}`.trim(),
        retryable: true,
      },
    })
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string }
  const accessToken = tokenJson.access_token
  if (!accessToken) {
    return CreatePayPalCheckoutOutputSchema.parse({
      status: 'retryable_error',
      checkoutUrl: '',
      transactionId: '',
      error: {
        code: 'PAYPAL_OAUTH_MISSING_TOKEN',
        message: 'PayPal auth response did not include an access token.',
        retryable: true,
      },
    })
  }

  const orderResponse = await fetch(`${apiBaseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: parsed.sessionId,
          invoice_id: parsed.sessionId,
          amount: {
            currency_code: parsed.currency,
            value: formatAmount(parsed.amount),
          },
        },
      ],
      application_context: {
        return_url: parsed.returnUrl,
        cancel_url: parsed.cancelUrl,
        user_action: 'PAY_NOW',
      },
    }),
  })

  if (!orderResponse.ok) {
    const body = await orderResponse.text().catch(() => '')
    return CreatePayPalCheckoutOutputSchema.parse({
      status: 'retryable_error',
      checkoutUrl: '',
      transactionId: '',
      error: {
        code: 'PAYPAL_ORDER_CREATE_FAILED',
        message: `PayPal order creation failed (${orderResponse.status}). ${body}`.trim(),
        retryable: true,
      },
    })
  }

  const orderJson = (await orderResponse.json()) as {
    id?: string
    links?: Array<{ rel?: string; href?: string }>
  }
  const transactionId = orderJson.id ?? ''
  const checkoutUrl = orderJson.links?.find((link) => link.rel === 'approve')?.href ?? ''

  if (!transactionId || !checkoutUrl) {
    return CreatePayPalCheckoutOutputSchema.parse({
      status: 'retryable_error',
      checkoutUrl: '',
      transactionId: '',
      error: {
        code: 'PAYPAL_ORDER_MISSING_APPROVAL_LINK',
        message: 'PayPal order response did not include order id or approval URL.',
        retryable: true,
      },
    })
  }

  return CreatePayPalCheckoutOutputSchema.parse({
    status: 'success',
    checkoutUrl,
    transactionId,
  })
}
