import { ChatSession } from '@genui-a3/core'
import { collectorInitialState, CollectorState } from '../../agents/collector'
import { getSessionStore } from '../session/store'
import { withSessionLock } from '../session/sessionLock'
import { getA3Provider } from './provider'

const store = getSessionStore<CollectorState, Record<string, unknown>>()
const provider = getA3Provider()

export function createCollectorSession(sessionId: string) {
  return new ChatSession<CollectorState>({
    sessionId,
    store,
    provider,
    initialAgentId: 'onboarding_orchestrator',
    initialState: collectorInitialState,
  })
}

export async function applySessionStateUpdate(
  sessionId: string,
  update: Partial<CollectorState>,
  agentId?: string,
) {
  return withSessionLock(sessionId, async () => {
    const session = createCollectorSession(sessionId)
    const existing = await session.getSessionData()

    await session.upsertSessionData({
      activeAgentId: (agentId ?? existing?.activeAgentId ?? 'onboarding_orchestrator') as any,
      state: {
        ...(existing?.state ?? collectorInitialState),
        ...update,
      },
    })
  })
}

export async function updateSessionState(
  sessionId: string,
  updater: (current: CollectorState) => CollectorState,
  agentId?: string,
) {
  return withSessionLock(sessionId, async () => {
    const session = createCollectorSession(sessionId)
    const existing = await session.getSessionData()
    const current = (existing?.state ?? collectorInitialState) as CollectorState
    const next = updater(current)

    await session.upsertSessionData({
      activeAgentId: (agentId ?? existing?.activeAgentId ?? 'onboarding_orchestrator') as any,
      state: next,
    })
  })
}

export async function injectSystemEvent(sessionId: string, message: string) {
  return withSessionLock(sessionId, async () => {
    const session = createCollectorSession(sessionId)
    return session.send(message)
  })
}
