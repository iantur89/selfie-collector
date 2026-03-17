'use client'

import { useState, useCallback, useRef } from 'react'
import { Typography } from '@mui/material'
import { ChatMessageList } from '@organisms/ChatMessageList'
import { ChatContainer, ChatHeader } from '@atoms'
import { ChatInput } from '@molecules'
import type { ChatMessage as ChatMessageType } from 'types'
import { HttpAgent, EventType } from '@ag-ui/client'

const agent = new HttpAgent({
  url: '/api/agui',
})

export function AguiChat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const assistantIdRef = useRef<string>('')

  const handleSubmit = useCallback(async (text: string) => {
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      body: text,
      source: 'user',
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    let assistantId = crypto.randomUUID()
    assistantIdRef.current = assistantId

    const streamingMsg: ChatMessageType = {
      id: assistantId,
      body: '',
      source: 'assistant',
      isStreaming: true,
    }
    setMessages((prev) => [...prev, streamingMsg])

    try {
      const runId = crypto.randomUUID()

      // Add the user message to the agent's internal state BEFORE running.
      agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })

      await agent.runAgent(
        {
          runId,
          tools: [],
          context: [],
          forwardedProps: {},
        },
        {
          onEvent({ event }) {
            if (event.type === EventType.TEXT_MESSAGE_CONTENT && 'delta' in event) {
              const delta = (event as unknown as { delta: string }).delta
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, body: m.body + delta } : m)))
            } else if (event.type === EventType.CUSTOM && 'name' in event) {
              const customEvent = event as unknown as { name: string }
              if (customEvent.name === 'AgentTransition') {
                const prevAssistantId = assistantId
                assistantId = crypto.randomUUID()
                assistantIdRef.current = assistantId
                setMessages((prev) => {
                  const updated = prev.map((m) => (m.id === prevAssistantId ? { ...m, isStreaming: false } : m))
                  return [...updated, { id: assistantId, body: '', source: 'assistant', isStreaming: true }]
                })
              }
            } else if (event.type === EventType.RUN_FINISHED) {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)))
            } else if (event.type === EventType.RUN_ERROR) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, body: m.body || 'Sorry, something went wrong.', isStreaming: false }
                    : m,
                ),
              )
            }
          },
        },
      )
    } catch (error) {
      console.error('AG-UI chat error:', error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, body: m.body || 'Sorry, something went wrong. Please try again.', isStreaming: false }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)))
    }
  }, [])

  return (
    <ChatContainer elevation={0}>
      <ChatHeader>
        <Typography variant="h6" component="h2">
          Chat (AG-UI Protocol)
        </Typography>
      </ChatHeader>
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </ChatContainer>
  )
}
