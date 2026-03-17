import { BaseState, Provider, ProviderRequest, ProviderResponse, StreamEvent } from '@genui-a3/core'
import { createBedrockProvider } from '@genui-a3/providers/bedrock'
import { env } from '../config/env'

class LocalJsonProvider implements Provider {
  readonly name = 'local-json-provider'

  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    const lastUserMessage = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
    const response = {
      chatbotMessage: `Received: ${lastUserMessage}`,
      goalAchieved: false,
    }
    return { content: JSON.stringify(response) }
  }

  async *sendRequestStream<TState extends BaseState = BaseState>(
    request: ProviderRequest,
  ): AsyncIterable<StreamEvent<TState>> {
    const messageId = `local-${Date.now()}`
    const delta = `Received: ${request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''}`

    yield {
      type: 'TEXT_MESSAGE_START' as any,
      messageId,
      role: 'assistant',
    }
    yield {
      type: 'TEXT_MESSAGE_CONTENT' as any,
      messageId,
      delta,
    }
    yield {
      type: 'TEXT_MESSAGE_END' as any,
      messageId,
    }
  }
}

function createProvider(): Provider {
  const modelIds = env.bedrockModelIds.trim().split(',').map((s) => s.trim()).filter(Boolean)
  if (modelIds.length > 0) {
    return createBedrockProvider({
      region: env.awsRegion,
      models: modelIds,
    })
  }
  return new LocalJsonProvider()
}

let provider: Provider | null = null

export function getA3Provider(): Provider {
  if (!provider) {
    provider = createProvider()
  }
  return provider
}
