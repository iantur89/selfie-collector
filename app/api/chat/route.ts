/**
 * Synchronous (blocking / unary) chat endpoint.
 * This is the non-streaming version of the /api/stream endpoint.
 * It waits for the full agent response before returning a complete JSON payload.
 */
import { NextRequest, NextResponse } from 'next/server'
import { AgentRegistry, ChatSession } from '@genui-a3/core'
import { collectorInitialState, CollectorState } from '../../agents/collector'
import { getSessionStore } from '../../server/session/store'
import { withSessionLock } from '../../server/session/sessionLock'
import { registerCollectorAgents } from '../../server/a3/registry'
import { getA3Provider } from '../../server/a3/provider'

registerCollectorAgents()
const registry = AgentRegistry.getInstance<CollectorState>()

const store = getSessionStore<CollectorState, Record<string, unknown>>()
const provider = getA3Provider()

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string }
    const { message, sessionId = 'demo-session' } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const result = await withSessionLock(sessionId, async () => {
      const session = new ChatSession<CollectorState>({
        sessionId,
        store,
        provider,
        initialAgentId: 'onboarding_orchestrator',
        initialState: collectorInitialState,
      })
      return session.send(message)
    })

    return NextResponse.json({
      response: result.responseMessage,
      activeAgentId: result.activeAgentId,
      nextAgentId: result.nextAgentId,
      state: result.state,
      goalAchieved: result.goalAchieved,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

// GET endpoint to list available agents
export function GET() {
  const agents = AgentRegistry.getInstance().getAll()
  return NextResponse.json({
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
    })),
  })
}
