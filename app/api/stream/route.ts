import { NextRequest } from 'next/server'
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
  const body = (await request.json()) as { message?: string; sessionId?: string }
  const { message, sessionId = 'demo-stream-session' } = body

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await withSessionLock(sessionId, async () => {
          const session = new ChatSession<CollectorState>({
            sessionId,
            store,
            provider,
            initialAgentId: 'onboarding_orchestrator',
            initialState: collectorInitialState,
          })

          for await (const event of session.sendStream(message)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        })
      } catch (error) {
        const errorEvent = {
          type: 'error',
          error: { message: String(error) },
          agentId: 'unknown',
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
