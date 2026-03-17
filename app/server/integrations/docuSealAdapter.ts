import { CreateSigningLinkInputSchema, CreateSigningLinkOutputSchema } from '../../contracts/tools'
import { getConsentProvider } from './consent/provider'

export async function createSigningLink(input: unknown) {
  const parsed = CreateSigningLinkInputSchema.parse(input)
  const provider = getConsentProvider()
  const result = await provider.createSigningLink(parsed)
  return CreateSigningLinkOutputSchema.parse(result)
}
