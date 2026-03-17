import { CreateSigningLinkOutputSchema } from '../../../../contracts/tools'
import { env } from '../../../config/env'
import { ConsentProvider, CreateSigningLinkInput } from '../types'

type DocuSealSubmitter = {
  submission_id?: number
  id?: number
  embed_src?: string
}

const DEFAULT_SUBMITTER_ROLE = 'Signer'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

function getDocuSealApiCandidates(): string[] {
  const configuredApiBase = env.docuSealApiBaseUrl.trim()
  if (configuredApiBase.length > 0) {
    return [trimTrailingSlash(configuredApiBase)]
  }

  const baseUrl = trimTrailingSlash(env.docuSealBaseUrl)
  if (!baseUrl) return []
  return [baseUrl, `${baseUrl}/api`]
}

async function createSubmissionAtBase(
  apiBaseUrl: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; submitters: DocuSealSubmitter[] } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': env.docuSealApiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      return {
        ok: false,
        message: `DocuSeal API ${response.status}: ${text || response.statusText}`,
      }
    }

    const data = (await response.json()) as unknown
    if (!Array.isArray(data)) {
      return { ok: false, message: 'DocuSeal API returned unexpected response shape' }
    }
    return { ok: true, submitters: data as DocuSealSubmitter[] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, message }
  }
}

export class DocuSealConsentProvider implements ConsentProvider {
  readonly id = 'docuseal'

  async createSigningLink(input: CreateSigningLinkInput) {
    if (!env.docuSealApiKey || !env.docuSealTemplateId) {
      return CreateSigningLinkOutputSchema.parse({
        status: 'fatal_error',
        signingUrl: '',
        documentId: '',
        error: {
          code: 'DOCUSEAL_CONFIG_MISSING',
          message: 'DOCUSEAL_API_KEY and DOCUSEAL_TEMPLATE_ID are required for consent provider "docuseal".',
          retryable: false,
        },
      })
    }

    const submitter: Record<string, unknown> = {
      role: env.docuSealSubmitterRole || DEFAULT_SUBMITTER_ROLE,
      name: input.name ?? input.userId,
      external_id: input.userId,
      metadata: {
        sessionId: input.sessionId,
        userId: input.userId,
      },
    }
    if (input.email) {
      submitter.email = input.email
    } else {
      submitter.send_email = false
    }

    const payload: Record<string, unknown> = {
      template_id: Number(env.docuSealTemplateId),
      send_email: Boolean(input.email),
      completed_redirect_url: input.callbackUrl,
      submitters: [submitter],
    }

    let lastError = 'No DocuSeal API base URL configured.'
    for (const apiBase of getDocuSealApiCandidates()) {
      const result = await createSubmissionAtBase(apiBase, payload)
      if (!result.ok) {
        lastError = result.message
        continue
      }

      const primary = result.submitters[0]
      if (!primary?.embed_src) {
        lastError = 'DocuSeal response did not include submitter embed_src'
        continue
      }

      return CreateSigningLinkOutputSchema.parse({
        status: 'success',
        signingUrl: primary.embed_src,
        documentId: String(primary.submission_id ?? primary.id ?? ''),
      })
    }

    return CreateSigningLinkOutputSchema.parse({
      status: 'retryable_error',
      signingUrl: '',
      documentId: '',
      error: {
        code: 'DOCUSEAL_CREATE_SUBMISSION_FAILED',
        message: lastError,
        retryable: true,
      },
    })
  }
}
