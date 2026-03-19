import { z } from 'zod'
import { BaseState } from '@genui-a3/core'

export const CONTRACT_VERSION = 'v1'

export const WorkflowStageSchema = z.enum([
  'onboarding_orchestrator',
  'id_verify_agent',
  'consent_agent',
  'payment_agent',
  'ingest_agent',
  'completion_agent',
])

export const VerificationStatusSchema = z.enum(['pending', 'verified', 'rejected', 'inconclusive', 'error'])

export const ConsentStatusSchema = z.enum(['pending', 'link_sent', 'completed', 'rejected', 'expired', 'error'])

export const PaymentStatusSchema = z.enum(['pending', 'authorized', 'paid', 'failed', 'expired', 'error'])

export const SelfieSubmissionStatusSchema = z.enum(['accepted', 'rejected'])

export const SelfieTagSchema = z.object({
  selfieId: z.string(),
  angle: z.enum(['frontal', 'left', 'right', 'up', 'down', 'high_angle', 'low_angle']).optional(),
  lighting: z.enum(['dark', 'normal', 'bright']).optional(),
  gender: z.enum(['female', 'male', 'non_binary', 'unknown']).optional(),
  demographics: z.array(z.string()).default([]),
  quality: z.object({
    blurScore: z.number().min(0).max(1).optional(),
    occluded: z.boolean().optional(),
    resolutionBucket: z.enum(['low', 'medium', 'high']).optional(),
  }),
  confidence: z.number().min(0).max(1),
  modelName: z.string(),
  modelVersion: z.string(),
  createdAt: z.string(),
})

export const CollectorStateSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  workflowStage: WorkflowStageSchema.default('onboarding_orchestrator'),
  telegramChatId: z.string().optional(),
  telegramUserId: z.string().optional(),
  name: z.string().optional(),
  idVerified: z.boolean().default(false),
  selfieVerified: z.boolean().default(false),
  faceMatched: z.boolean().default(false),
  verificationStatus: VerificationStatusSchema.default('pending'),
  verificationAttempts: z.number().int().default(0),
  idImageS3Key: z.string().optional(),
  selfieImageS3Key: z.string().optional(),
  consentGiven: z.boolean().default(false),
  consentStatus: ConsentStatusSchema.default('pending'),
  consentDocumentId: z.string().optional(),
  consentTemplateVersion: z.string().optional(),
  paymentCompleted: z.boolean().default(false),
  paymentStatus: PaymentStatusSchema.default('pending'),
  paymentProvider: z.literal('paypal').default('paypal'),
  paymentTransactionId: z.string().optional(),
  paymentCheckoutUrl: z.string().optional(),
  /** PayPal (or other) email for sending payouts to the user. Set when user provides it in payment_agent. */
  payoutEmail: z.string().optional(),
  /** PayPal payout_batch_id after we've sent a payout for this session (avoids double-paying). */
  payoutBatchId: z.string().optional(),
  selfieCount: z.number().int().default(0),
  minSelfiesRequired: z.number().int().default(5),
  maxSelfiesAllowed: z.number().int().default(20),
  acceptedSelfieIds: z.array(z.string()).default([]),
  rejectedSelfieIds: z.array(z.string()).default([]),
  selfieTags: z.array(SelfieTagSchema).default([]),
  eventIdsProcessed: z.array(z.string()).default([]),
  lastErrorCode: z.string().optional(),
  lastErrorMessage: z.string().optional(),
})

export type CollectorState = z.infer<typeof CollectorStateSchema> & BaseState
