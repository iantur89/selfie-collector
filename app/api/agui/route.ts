import { NextRequest } from 'next/server'
import { EventType, type RunAgentInput } from '@ag-ui/client'
import { EventEncoder } from '@ag-ui/encoder'
import { AgentRegistry, ChatSession, AGUIAgent } from '@genui-a3/core'
import { collectorInitialState, CollectorState } from '../../agents/collector'
import { getSessionStore } from '../../server/session/store'
import { registerCollectorAgents } from '../../server/a3/registry'
import { getA3Provider } from '../../server/a3/provider'

registerCollectorAgents()
const registry = AgentRegistry.getInstance<CollectorState>()

const store = getSessionStore<CollectorState, Record<string, unknown>>()
const provider = getA3Provider()

const a3Agent = new AGUIAgent({
  agentId: 'a3-demo',
  createSession: (input: RunAgentInput) =>
    new ChatSession<CollectorState>({
      sessionId: input.threadId,
      store,
      provider,
      initialAgentId: 'onboarding_orchestrator',
      initialState: collectorInitialState,
    }),
})

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RunAgentInput

  const encoder = new EventEncoder()
  const events$ = a3Agent.run(body)

  const stream = new ReadableStream({
    start(controller) {
      const textEncoder = new TextEncoder()
      const subscription = events$.subscribe({
        next(event) {
          controller.enqueue(textEncoder.encode(encoder.encodeSSE(event)))
        },
        error(err) {
          const errorEvent = {
            type: EventType.RUN_ERROR,
            message: String(err),
          }
          controller.enqueue(textEncoder.encode(encoder.encodeSSE(errorEvent)))
          controller.close()
        },
        complete() {
          controller.close()
        },
      })

      // Clean up on cancel
      request.signal.addEventListener('abort', () => {
        subscription.unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': encoder.getContentType(),
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
