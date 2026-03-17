import { MESSAGE_SENDER } from '@constants/chat'

export type ChatMessage = {
  id: string
  body: string
  source: (typeof MESSAGE_SENDER)[keyof typeof MESSAGE_SENDER]
  isStreaming?: boolean
}
