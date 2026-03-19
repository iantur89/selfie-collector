import { randomUUID } from 'node:crypto'
import { CreatePayPalCheckoutInputSchema, CreatePayPalCheckoutOutputSchema } from '../../contracts/tools'
import { env } from '../config/env'

export function getPayPalApiBaseUrl(): string {
  return env.payPalBaseUrl.includes('sandbox')
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

function formatAmount(value: number): string {
  return value.toFixed(2)
}

/** Get OAuth2 access token for PayPal REST APIs (Checkout, Payouts). Returns null if creds missing or auth fails. */
export async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = env.payPalClientId?.trim()
  const clientSecret = env.payPalClientSecret?.trim()
  if (!clientId || !clientSecret) return null

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
  if (!tokenResponse.ok) return null
  const tokenJson = (await tokenResponse.json()) as { access_token?: string }
  return tokenJson.access_token ?? null
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

export type CreatePayPalPayoutInput = {
  recipientEmail: string
  amount: number
  currency: string
  note?: string
  senderItemId: string
}

export type CreatePayPalPayoutResult =
  | { status: 'success'; payoutBatchId: string }
  | { status: 'retryable_error'; error: { code: string; message: string } }
  | { status: 'fatal_error'; error: { code: string; message: string } }

/**
 * Create a single-item PayPal Payout (send money to recipient email).
 * Requires PayPal app to have Payouts product enabled (Developer Dashboard).
 */
export async function createPayPalPayout(input: CreatePayPalPayoutInput): Promise<CreatePayPalPayoutResult> {
  const accessToken = await getPayPalAccessToken()
  if (!accessToken) {
    return {
      status: 'fatal_error',
      error: { code: 'PAYPAL_NO_ACCESS_TOKEN', message: 'PayPal credentials not configured or auth failed.' },
    }
  }

  const senderBatchId = `payout_${input.senderItemId}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  const apiBaseUrl = getPayPalApiBaseUrl()

  const body = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: 'You have a payout!',
      email_message: input.note ?? 'You have received a payout.',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: { value: formatAmount(input.amount), currency: input.currency },
        note: input.note ?? 'Payout',
        sender_item_id: input.senderItemId,
        receiver: input.recipientEmail,
      },
    ],
  }

  const res = await fetch(`${apiBaseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text().catch(() => '')
  if (!res.ok) {
    const isRetryable = res.status >= 500 || res.status === 429
    return {
      status: isRetryable ? 'retryable_error' : 'fatal_error',
      error: {
        code: `PAYPAL_PAYOUT_${res.status}`,
        message: text ? text.slice(0, 500) : `PayPal Payouts API returned ${res.status}`,
      },
    }
  }

  let json: { batch_header?: { payout_batch_id?: string } }
  try {
    json = JSON.parse(text) as { batch_header?: { payout_batch_id?: string } }
  } catch {
    return {
      status: 'fatal_error',
      error: { code: 'PAYPAL_PAYOUT_PARSE', message: 'Invalid response from PayPal.' },
    }
  }

  const payoutBatchId = json.batch_header?.payout_batch_id
  if (!payoutBatchId) {
    return {
      status: 'fatal_error',
      error: { code: 'PAYPAL_PAYOUT_NO_BATCH_ID', message: 'Response missing payout_batch_id.' },
    }
  }

  return { status: 'success', payoutBatchId }
}
