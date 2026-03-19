import { z } from 'zod'
import { Agent } from '@genui-a3/core'
import { CollectorState, CollectorStateSchema } from '../contracts/state'
export type { CollectorState } from '../contracts/state'

const orchestratorOutput = z.object({
  name: z.string().optional(),
})

const idVerifyOutput = z.object({
  verificationStatus: z.enum(['pending', 'verified', 'rejected', 'inconclusive', 'error']).optional(),
})

const consentOutput = z.object({
  consentStatus: z.enum(['pending', 'link_sent', 'completed', 'rejected', 'expired', 'error']).optional(),
})

const paymentOutput = z.object({
  paymentStatus: z.enum(['pending', 'authorized', 'paid', 'failed', 'expired', 'error']).optional(),
})

const ingestOutput = z.object({
  selfieCount: z.number().int().optional(),
})

const completionOutput = z.object({})

export const onboardingOrchestratorAgent: Agent<CollectorState> = {
  id: 'onboarding_orchestrator',
  prompt: `
You are the onboarding orchestrator for a selfie data collector bot.
Collect and confirm the user's name if missing.
If name is known, explain the next step is ID + selfie verification.
Set goalAchieved=true once name is captured.
`,
  outputSchema: orchestratorOutput,
  transition: (state, goalAchieved) => {
    if (goalAchieved && state.name) {
      return 'id_verify_agent'
    }
    return 'onboarding_orchestrator'
  },
}

export const idVerifyAgent: Agent<CollectorState> = {
  id: 'id_verify_agent',
  prompt: `
You manage identity verification.
If user has not yet uploaded ID + selfie, ask for both.
If verification is pending, tell user it is being checked.
If verification is verified, explain we can proceed to consent.
If rejected or inconclusive, explain retry guidance.
`,
  outputSchema: idVerifyOutput,
  transition: (state) => {
    if (state.idVerified && state.selfieVerified && state.faceMatched) {
      return 'consent_agent'
    }
    return 'id_verify_agent'
  },
}

export const consentAgent: Agent<CollectorState> = {
  id: 'consent_agent',
  prompt: `
You manage consent.
If consent is not completed, share consent instructions.
If consent is completed, acknowledge and proceed to payout setup.
`,
  outputSchema: consentOutput,
  transition: (state) => {
    if (state.consentGiven) {
      return 'payment_agent'
    }
    return 'consent_agent'
  },
}

export const paymentAgent: Agent<CollectorState> = {
  id: 'payment_agent',
  prompt: `
You manage payout setup and confirmation (the user gets paid; the user does NOT pay us).
The user receives a one-time payout-setup link (e.g. from the previous message). If payment is incomplete, remind them to open that link to enter their PayPal email in the form; do NOT ask them to type their email in chat.
Do NOT ask the user to make a payment and do NOT provide checkout links.
Once payout details are collected via the form, payment setup is complete and the user moves to selfie ingest.
`,
  outputSchema: paymentOutput,
  transition: (state) => {
    if (state.paymentCompleted) {
      return 'ingest_agent'
    }
    return 'payment_agent'
  },
}

export const ingestAgent: Agent<CollectorState> = {
  id: 'ingest_agent',
  prompt: `
You collect selfies for ingestion.
Accepted range is 5 to 20 selfies.
If count < 5, ask for more.
If count >= 5, user may send DONE to finish.
If count reaches 20, auto-complete.
`,
  outputSchema: ingestOutput,
  transition: (state, goalAchieved) => {
    if (state.selfieCount >= state.maxSelfiesAllowed) {
      return 'completion_agent'
    }
    if (goalAchieved && state.selfieCount >= state.minSelfiesRequired) {
      return 'completion_agent'
    }
    return 'ingest_agent'
  },
}

export const completionAgent: Agent<CollectorState> = {
  id: 'completion_agent',
  prompt: `
You are the completion agent.
Thank the user and confirm their submission is complete.
`,
  outputSchema: completionOutput,
  transition: ['completion_agent'],
}

export const collectorAgents: Agent<CollectorState>[] = [
  onboardingOrchestratorAgent,
  idVerifyAgent,
  consentAgent,
  paymentAgent,
  ingestAgent,
  completionAgent,
]

export const collectorInitialState: CollectorState = CollectorStateSchema.parse({})
