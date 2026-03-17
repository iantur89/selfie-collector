function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
  dynamoSessionTable: process.env.DYNAMODB_SESSION_TABLE,
  dynamoIdempotencyTable: process.env.DYNAMODB_IDEMPOTENCY_TABLE,
  s3Bucket: process.env.S3_ARTIFACT_BUCKET,
  postgresUrl: process.env.POSTGRES_URL,
  consentProvider: process.env.CONSENT_PROVIDER ?? 'auto',
  docuSealBaseUrl: process.env.DOCUSEAL_BASE_URL ?? '',
  docuSealApiBaseUrl: process.env.DOCUSEAL_API_BASE_URL ?? '',
  docuSealApiKey: process.env.DOCUSEAL_API_KEY ?? '',
  docuSealTemplateId: process.env.DOCUSEAL_TEMPLATE_ID ?? '',
  docuSealSubmitterRole: process.env.DOCUSEAL_SUBMITTER_ROLE ?? 'Signer',
  docuSealWebhookSecret: process.env.DOCUSEAL_WEBHOOK_SECRET ?? '',
  payPalBaseUrl: process.env.PAYPAL_BASE_URL ?? 'https://www.paypal.com/checkoutnow',
  payPalWebhookSecret: process.env.PAYPAL_WEBHOOK_SECRET ?? '',
  payPalClientId: process.env.PAYPAL_CLIENT_ID ?? '',
  payPalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  /** Bedrock model ID(s) for A3 LLM; comma-separated for fallback. If set, app uses Bedrock instead of stub. */
  bedrockModelIds: process.env.BEDROCK_MODEL_IDS ?? '',
  /** Telegram bot token for getFile / downloading photos. Required to persist Telegram photos to S3 for Rekognition. */
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  require(varName: string) {
    return required(varName)
  },
}
