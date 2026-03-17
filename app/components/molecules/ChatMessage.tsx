import styled, { keyframes } from 'styled-components'
import { Typography } from '@mui/material'
import { MessageBubble } from '@atoms'
import { MESSAGE_SENDER } from '@constants/chat'
import type { ChatMessage as ChatMessageType } from 'types'

type Props = { message: ChatMessageType }

const MessageRow = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${({ $isUser }) => ($isUser ? 'flex-end' : 'flex-start')};
`

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`

const StreamingCursor = styled.span`
  display: inline-block;
  width: 6px;
  height: 14px;
  margin-left: 2px;
  background-color: currentColor;
  vertical-align: text-bottom;
  animation: ${blink} 0.8s step-end infinite;
`

export function ChatMessage({ message }: Props) {
  const isUser = message?.source === MESSAGE_SENDER.USER
  return (
    <MessageRow $isUser={isUser} data-testid="chat-message">
      <MessageBubble $isUser={isUser} elevation={0}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {message.body.trim()}
          {message.isStreaming && <StreamingCursor />}
        </Typography>
      </MessageBubble>
    </MessageRow>
  )
}
