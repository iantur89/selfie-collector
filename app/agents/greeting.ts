import { z } from 'zod'
import { Agent, BaseState } from '@genui-a3/core'

/**
 * Consumer defines their GLOBAL state extending BaseState.
 * This state is shared across ALL agents in the session.
 */
export interface State extends BaseState {
  userName?: string
  userAge?: string
}

/**
 * Sample greeting agent that demonstrates the AgentRegistry pattern.
 */
const greetingPayload = z.object({
  userName: z.string().optional(),
})

export const greetingAgent: Agent<State> = {
  id: 'greeting',
  prompt: `
    You are a friendly greeting agent. Your goal is to greet the user and learn their name.
    You also handle name changes — if the user wants to update their name, collect the new one.
    If you don't know their name yet, ask for it politely.
    Once you have their name, greet them by name and set goalAchieved to true.

    Do not ask "How can I help you today?".
  `,
  outputSchema: greetingPayload,
  transition: (state, agentGoalAchieved) => {
    if (agentGoalAchieved) {
      return 'age'
    }
    return 'greeting'
  },
}
