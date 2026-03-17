import { env } from '../../config/env'
import { DocuSealConsentProvider } from './providers/docuSealConsentProvider'
import { MockConsentProvider } from './providers/mockConsentProvider'
import { ConsentProvider } from './types'

let cachedProvider: ConsentProvider | null = null

function resolveProviderName(): 'docuseal' | 'mock' {
  const configured = env.consentProvider.toLowerCase()
  if (configured === 'docuseal' || configured === 'mock') {
    return configured
  }

  // Auto mode: if API inputs are available, use DocuSeal; otherwise use mock.
  if (env.docuSealApiKey && env.docuSealTemplateId) {
    return 'docuseal'
  }
  return 'mock'
}

export function getConsentProvider(): ConsentProvider {
  if (cachedProvider) return cachedProvider

  const providerName = resolveProviderName()
  cachedProvider = providerName === 'docuseal' ? new DocuSealConsentProvider() : new MockConsentProvider()
  return cachedProvider
}
