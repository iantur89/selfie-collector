import { randomUUID } from 'node:crypto'
import { CreateSigningLinkOutputSchema } from '../../../../contracts/tools'
import { env } from '../../../config/env'
import { ConsentProvider, CreateSigningLinkInput } from '../types'

export class MockConsentProvider implements ConsentProvider {
  readonly id = 'mock'

  async createSigningLink(input: CreateSigningLinkInput) {
    const documentId = randomUUID()
    const signingUrl = `${env.appBaseUrl}/consent/mock-sign/${documentId}?sid=${encodeURIComponent(input.sessionId)}`

    return CreateSigningLinkOutputSchema.parse({
      status: 'success',
      signingUrl,
      documentId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    })
  }
}
