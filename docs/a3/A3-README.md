# GenUI A3

**An open-source TypeScript framework for building multi-agent chat applications.**

Define focused agents.
Register them.
Let A3 route conversations dynamically.

## Who is this for?

- **Engineering teams** building conversational AI products that need multiple specialized agents working together
- **Product leaders** evaluating agent orchestration frameworks for TypeScript/Node.js stacks
- **Developers** who want to go from zero to a working multi-agent system in minutes, not weeks

## Why GenUI A3?

### The problem

Building agent-based chat applications is harder than it should be.
Most teams face the same challenges:

- Coordinating multiple specialized agents in a single conversation
- Managing shared state as users move between agents
- Getting structured, validated responses from LLMs
- Swapping LLM providers without rewriting business logic
- Persisting conversation sessions across requests

Existing frameworks solve pieces of this, this is an alternative approach without the complexity of writing graph definitions or managing complex state machines

### How A3 solves it

A3 approach: **define agents, register them, and let the framework handle routing.**

Each agent is a focused unit with a clear responsibility.
Agents decide when to hand off to another agent based on conversation context.
The framework manages the flow, state, and session persistence automatically.

There are no graphs to define.
No state machines to maintain.

### How A3 compares

| Capability | GenUI A3 | LangGraph | CrewAI | AutoGen |
|---|---|---|---|---|
| **Setup complexity** | Minimal | Moderate | Moderate | High |
| **Routing model** | Dynamic (agent-driven) | Static graph | Role-based | Conversation-based |
| **State management** | Shared global state | Graph state | Shared memory | Message passing |
| **TypeScript-native** | Yes | Python-first | Python-only | Python-first |
| **Structured output** | Zod schemas | Custom parsers | Pydantic | Custom parsers |
| **Session persistence** | Pluggable stores | Custom | Custom | Custom |

A3 optimizes for **simplicity and speed-to-value**.

## Architecture at a Glance

```text
┌──────────────────────────────────────────────────────────────┐
│                      Your Application                        │
└─────────────────────────┬────────────────────────────────────┘
                          │                          ▲
                .send(message)              ChatResponse
                          │              { responseMessage,
                          │                state, goalAchieved }
                          ▼                          │
┌──────────────────────────────────────────────────────────────┐
│                       ChatSession                            │
│                                                              │
│  1. Load session from store          6. Save updated session │
│  2. Append user message              5. Append bot message   │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ manageFlow({ agent,              │ { responseMessage,
            │   sessionData })                 │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                        ChatFlow                              │
│                                                              │
│  Looks up active agent, delegates, checks routing            │
│                                                              │
│  If nextAgent ≠ activeAgent:                                 │
│    ┌──────────────────────────────────────────┐              │
│    │  Recursive call to manageFlow            │              │
│    │  with new agent + updated state          │              │
│    └──────────────────────────────────────────┘              │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ generateAgentResponse            │ { chatbotMessage,
            │   ({ agent, sessionData })       │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                      Active Agent                            │
│                                                              │
│  • Builds system prompt (promptGenerator)                    │
│  • Defines output schema (Zod)                               │
│  • Determines next agent (nextAgentSelector)                 │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ prompt + schema                  │ structured JSON
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                       Provider                               │
│                      (Bedrock)                               │
│                                                              │
│  • Converts Zod → JSON Schema                               │
│  • Merges message history                                    │
│  • Model fallback on error                                   │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ API request                      │ API response
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                         LLM                                  │
└──────────────────────────────────────────────────────────────┘
```

**How it flows:**

1. Your app calls `session.send(message)` with the user's input
1. **ChatSession** loads session data (history, state) from the configured store and appends the user message
1. **ChatFlow** looks up the active agent and calls `generateAgentResponse`
1. The **Agent** builds a system prompt, defines its Zod output schema, and delegates to the provider
1. The **Provider** sends the request to the LLM and returns structured JSON
1. The **Agent** extracts state updates and a routing decision (`nextAgentId`) from the response
1. If the next agent differs from the active agent, ChatFlow **recursively calls `manageFlow`** with the new agent and updated state
1. **ChatSession** appends the bot message, saves the updated session, and returns a `ChatResponse` to your app

Agents route dynamically.
There is no fixed graph.
Each agent decides whether to continue or hand off based on the conversation.

## Core Concepts

### Agent

An agent is the fundamental building block.
Each agent has a focused responsibility and defines how it generates responses, what structured data it extracts, and when to hand off to another agent.

```typescript
import { z } from 'zod'
import { Agent, simpleAgentResponse, BaseState } from '@genui-a3/core'

interface MyState extends BaseState {
  userName?: string
}

const greetingAgent: Agent<MyState> = {
  // Identity
  id: 'greeting',
  name: 'Greeting Agent',
  description: 'Greets the user and collects their name',

  // Prompt: instructions for the LLM
  promptGenerator: async () => `
    You are a friendly greeting agent.
    Ask the user for their name, then greet them.
    Set goalAchieved to true once you know their name.
  `,

  // Output schema: Zod schema for structured data extraction
  outputSchema: z.object({
    userName: z.string().optional(),
  }),

  // Response generator: how to process the LLM response
  generateAgentResponse: simpleAgentResponse,

  // State mapper: merge extracted data into global state
  fitDataInGeneralFormat: (data, state) => ({
    ...state,
    ...data,
  }),

  // Routing: decide the next agent after each turn
  nextAgentSelector: (state, goalAchieved) => {
    return goalAchieved ? 'next-agent' : 'greeting'
  },
}
```

**Agent properties:**

| Property | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier for the agent |
| `name` | Yes | Human-readable display name |
| `description` | Yes | What this agent does (used in agent pool prompts) |
| `promptGenerator` | Yes | Async function returning the system prompt for this agent |
| `outputSchema` | Yes | Zod schema defining structured data to extract from LLM responses |
| `generateAgentResponse` | Yes | Function that orchestrates the full response cycle |
| `fitDataInGeneralFormat` | Yes | Maps extracted LLM data into the shared state object |
| `nextAgentSelector` | No | Determines the next agent based on state and goal status |
| `transitionsTo` | No | Array of agent IDs this agent is allowed to redirect to |
| `filterHistoryStrategy` | No | Custom function to filter conversation history before sending to the LLM |
| `modelId` | No | Override the default model for this agent |

### AgentRegistry

A singleton registry where all agents are registered before use.

```typescript
import { AgentRegistry } from '@genui-a3/core'

const registry = AgentRegistry.getInstance<MyState>()

// Register one or many agents
registry.register(greetingAgent)
registry.register([authAgent, mainAgent, wrapUpAgent])

// Query the registry
registry.has('greeting')           // true
registry.get('greeting')           // Agent object
registry.getAll()                  // All registered agents
registry.getDescriptions()         // { greeting: 'Greets the user...' }
registry.count                     // 4
```

### ChatSession

The primary interface your application uses to interact with A3.
Create a session, send messages, get responses.

```typescript
import { ChatSession, MemorySessionStore } from '@genui-a3/core'

const session = new ChatSession<MyState>({
  sessionId: 'user-123',
  store: new MemorySessionStore(),     // pluggable persistence
  initialAgentId: 'greeting',
  initialState: { userName: undefined },
})

// Send a message and get a structured response
const result = await session.send('Hello!')

result.responseMessage   // "Hi there! What's your name?"
result.activeAgentId     // 'greeting'
result.nextAgentId       // 'greeting'
result.state             // { userName: undefined }
result.goalAchieved      // false
result.sessionId         // 'user-123'
```

### State

A3 uses a shared global state object that flows across all agents in a session.
Define your state by extending `BaseState`.

```typescript
import { BaseState } from '@genui-a3/core'

interface AppState extends BaseState {
  userName?: string
  isAuthenticated: boolean
  currentStep: string
}
```

Each agent's `fitDataInGeneralFormat` merges its extracted data into this shared state.
When agents switch, the full state carries over.

### Output Schemas

Every agent defines a Zod schema for the structured data it needs to extract from LLM responses.
A3 merges this with base fields (`chatbotMessage`, `goalAchieved`, `redirectToAgent`) and validates the LLM output.

```typescript
// Static schema
const schema = z.object({
  userName: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
})

// Dynamic schema (based on current session state)
const dynamicSchema = (sessionData) => z.object({
  userName: z.string().describe(`Current: ${sessionData.state.userName ?? 'unknown'}`),
})
```

Schemas serve two purposes:

1. **Instruct the LLM** on what data to extract (field names and descriptions become part of the prompt)
1. **Validate the response** at runtime so your application always receives well-typed data

### Routing

Agents route to each other in three ways:

**1. `nextAgentSelector`** -- Choose the next agent programmatically after each turn:

```typescript
nextAgentSelector: (state, goalAchieved) => {
  if (goalAchieved) return 'main-menu'
  if (state.failedAttempts > 3) return 'escalation'
  return 'auth'  // stay on current agent
}
```

**2. `redirectToAgent`** -- The LLM itself can request a redirect via the base response schema.
The agent's prompt and agent pool listing tell the LLM which agents are available.

**3. `transitionsTo`** -- Constrain which agents the LLM can redirect to:

```typescript
const agent: Agent<MyState> = {
  id: 'triage',
  transitionsTo: ['billing', 'support', 'account'],
  // LLM can only redirect to these three agents
  // ...
}
```

When a redirect happens, **ChatFlow recursively invokes the next agent** in the same request.
The user sees a single response, even if multiple agents were involved.

### Session Stores

A3 uses pluggable session stores for persistence.
Any object implementing the `SessionStore` interface works.

```typescript
interface SessionStore<TState extends BaseState> {
  load(sessionId: string): Promise<SessionData<TState> | null>
  save(sessionId: string, data: SessionData<TState>): Promise<void>
  delete?(sessionId: string): Promise<void>
}
```

**Built-in stores:**

| Store | Use case |
|---|---|
| `MemorySessionStore` | Development and testing (sessions lost on restart) |
| `AgentCoreMemoryStore` | AWS Bedrock AgentCore integration for persistent storage |

**Custom stores** are straightforward to implement for Redis, DynamoDB, PostgreSQL, or any other backend.

### Providers

Providers handle communication with LLM backends.
A3 ships with an AWS Bedrock provider and is designed so additional providers can be added.

```typescript
import { sendChatRequest } from '@genui-a3/core'
```

The Bedrock provider:

- Sends structured requests via the AWS Bedrock Converse API
- Uses tool-based JSON extraction for reliable structured output
- Supports model fallback (primary model fails, falls back to secondary)
- Merges sequential same-sender messages for API compatibility
- Applies agent-specific history filtering before sending

## [Quick Start](./quick-start.md)

Install, define a simple agent, register it, and send a message -- all in ~20 lines of code.

## [Multi-Agent Example](./multi-agent-example.md)

Three agents routing between each other, demonstrating state flowing across agent boundaries and automatic agent chaining.

## Roadmap

### Streaming Responses -- Coming Soon

Real-time token streaming via the AG-UI protocol.
Instead of waiting for a complete response, your frontend receives tokens as they're generated.

### Simplified Agent API -- Coming Soon

Reduce agent definitions to just the essentials.
Many of the current required properties will get sensible defaults, bringing the minimum agent definition down to 1-2 required parameters.

### Provider Abstraction -- Coming Soon

First-class support for multiple LLM providers:
OpenAI, Anthropic, AWS Bedrock, and custom providers.
Switch between providers without changing agent code.

### AG-UI Protocol -- Coming Soon

Full compliance with the [ag-ui.com](https://ag-ui.com) protocol for standardized agent-to-frontend event streaming.
Connect any AG-UI compatible frontend to your A3 agents.

## API Reference

### Core Exports

| Export | Type | Description |
|---|---|---|
| `ChatSession` | Class | Primary interface for sending messages and managing conversations |
| `AgentRegistry` | Class | Singleton registry for agent registration and lookup |
| `simpleAgentResponse` | Function | Default response generator for agents |
| `getAgentResponse` | Function | Low-level agent response pipeline (prompt, schema, LLM call, validation) |
| `manageFlow` | Function | Recursive chat flow orchestration with automatic agent chaining |
| `createFullOutputSchema` | Function | Merges agent schema with base response fields |
| `sendChatRequest` | Function | Sends structured requests to the LLM provider |
| `MemorySessionStore` | Class | In-memory session store for development and testing |
| `AgentCoreMemoryStore` | Class | AWS Bedrock AgentCore session store |

### ChatSession Methods

| Method | Returns | Description |
|---|---|---|
| `send(message)` | `Promise<ChatResponse<TState>>` | Send a user message and get the agent's response |
| `getSessionData()` | `Promise<SessionData<TState> \| null>` | Load current session state without sending a message |
| `getHistory()` | `Promise<Message[]>` | Retrieve conversation history |
| `clear()` | `Promise<void>` | Delete the session from the store |

### AgentRegistry Methods

| Method | Returns | Description |
|---|---|---|
| `getInstance()` | `AgentRegistry<TState>` | Get the singleton instance |
| `register(agents)` | `void` | Register one or more agents (throws on duplicate ID) |
| `unregister(id)` | `boolean` | Remove an agent by ID |
| `get(id)` | `Agent<TState> \| undefined` | Look up an agent by ID |
| `getAll()` | `Agent<TState>[]` | Get all registered agents |
| `has(id)` | `boolean` | Check if an agent is registered |
