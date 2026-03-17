import { z } from 'zod'
import { CreateSigningLinkInputSchema, CreateSigningLinkOutputSchema } from '../../../contracts/tools'

export type CreateSigningLinkInput = z.infer<typeof CreateSigningLinkInputSchema>
export type CreateSigningLinkOutput = z.infer<typeof CreateSigningLinkOutputSchema>

export interface ConsentProvider {
  readonly id: string
  createSigningLink(input: CreateSigningLinkInput): Promise<CreateSigningLinkOutput>
}
