import { ValidateSelfieInputSchema, ValidateSelfieOutputSchema } from '../../contracts/tools'

export async function validateSelfie(input: unknown) {
  const parsed = ValidateSelfieInputSchema.parse(input)
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(parsed.selfieS3Key)

  return ValidateSelfieOutputSchema.parse({
    status: 'success',
    accepted: isImage,
    reason: isImage ? undefined : 'Only image files are accepted for selfie upload',
  })
}
