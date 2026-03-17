import { z } from 'zod'

export const ToolResultStatusSchema = z.enum(['success', 'retryable_error', 'fatal_error'])

export const ToolErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().default(false),
})

export const VerifyDocumentAndSelfieInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  idImageS3Key: z.string(),
  selfieImageS3Key: z.string(),
})

export const VerifyDocumentAndSelfieOutputSchema = z.object({
  status: ToolResultStatusSchema,
  outcome: z.enum(['verified', 'rejected', 'inconclusive']),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
  error: ToolErrorSchema.optional(),
})

export const FaceMatchInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  idImageS3Key: z.string(),
  selfieImageS3Key: z.string(),
})

export const FaceMatchOutputSchema = z.object({
  status: ToolResultStatusSchema,
  matched: z.boolean(),
  score: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  error: ToolErrorSchema.optional(),
})

export const CreateSigningLinkInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  callbackUrl: z.string(),
})

export const CreateSigningLinkOutputSchema = z.object({
  status: ToolResultStatusSchema,
  signingUrl: z.string(),
  documentId: z.string(),
  expiresAt: z.string().optional(),
  error: ToolErrorSchema.optional(),
})

export const CreatePayPalCheckoutInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  returnUrl: z.string(),
  cancelUrl: z.string(),
})

export const CreatePayPalCheckoutOutputSchema = z.object({
  status: ToolResultStatusSchema,
  checkoutUrl: z.string(),
  transactionId: z.string(),
  error: ToolErrorSchema.optional(),
})

export const ValidateSelfieInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  selfieS3Key: z.string(),
})

export const ValidateSelfieOutputSchema = z.object({
  status: ToolResultStatusSchema,
  accepted: z.boolean(),
  reason: z.string().optional(),
  error: ToolErrorSchema.optional(),
})

export const TagSelfieInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  selfieS3Key: z.string(),
})

export const TagSelfieOutputSchema = z.object({
  status: ToolResultStatusSchema,
  tags: z.object({
    demographics: z.array(z.string()).default([]),
    gender: z.enum(['female', 'male', 'non_binary', 'unknown']),
    lighting: z.enum(['dark', 'normal', 'bright']),
    angle: z.enum(['frontal', 'left', 'right', 'up', 'down', 'high_angle', 'low_angle']),
    quality: z.object({
      blurScore: z.number().min(0).max(1),
      occluded: z.boolean(),
      resolutionBucket: z.enum(['low', 'medium', 'high']),
    }),
  }),
  confidence: z.number().min(0).max(1),
  modelName: z.string(),
  modelVersion: z.string(),
  error: ToolErrorSchema.optional(),
})

export const PersistArtifactInputSchema = z.object({
  bucket: z.string(),
  key: z.string(),
  contentType: z.string(),
  bytesBase64: z.string(),
  metadata: z.record(z.string(), z.string()).default({}),
})

export const PersistArtifactOutputSchema = z.object({
  status: ToolResultStatusSchema,
  bucket: z.string(),
  key: z.string(),
  etag: z.string().optional(),
  error: ToolErrorSchema.optional(),
})

export const QueryDatasetInputSchema = z.object({
  filters: z.object({
    angle: z.array(z.string()).optional(),
    lighting: z.array(z.string()).optional(),
    gender: z.array(z.string()).optional(),
    demographics: z.array(z.string()).optional(),
    verified: z.boolean().optional(),
    consented: z.boolean().optional(),
    paid: z.boolean().optional(),
  }),
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(200).default(20),
  }),
})

export const QueryDatasetOutputSchema = z.object({
  status: ToolResultStatusSchema,
  total: z.number().int().min(0),
  items: z.array(
    z.object({
      selfieId: z.string(),
      s3Key: z.string(),
      tags: z.record(z.string(), z.unknown()),
      userId: z.string(),
      sessionId: z.string(),
      createdAt: z.string(),
    }),
  ),
  error: ToolErrorSchema.optional(),
})
