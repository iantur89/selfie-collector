import { AgentRegistry } from '@genui-a3/core'
import { collectorAgents, CollectorState } from '../../agents/collector'

const registry = AgentRegistry.getInstance<CollectorState>()

export function registerCollectorAgents() {
  for (const agent of collectorAgents) {
    if (!registry.has(agent.id)) {
      registry.register(agent)
    }
  }
}
