import { BaseChatContext, BaseState, MemorySessionStore, SessionStore } from '@genui-a3/core'
import { DynamoSessionStore } from './dynamoSessionStore'

let sharedStore: SessionStore<any, any> | null = null

export function getSessionStore<TState extends BaseState, TContext extends BaseChatContext>(): SessionStore<
  TState,
  TContext
> {
  if (sharedStore) {
    return sharedStore as SessionStore<TState, TContext>
  }

  const sessionTable = process.env.DYNAMODB_SESSION_TABLE
  if (sessionTable) {
    sharedStore = new DynamoSessionStore<TState, TContext>({
      tableName: sessionTable,
      region: process.env.AWS_REGION,
    })
    return sharedStore
  }

  sharedStore = new MemorySessionStore<TState, TContext>()
  return sharedStore
}
