import { BaseChatContext, BaseState, SessionData, SessionStore } from '@genui-a3/core'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

interface DynamoSessionStoreConfig {
  tableName: string
  region?: string
}

type SessionRecord<TState extends BaseState, TContext extends BaseChatContext> = {
  sessionId: string
  payload: SessionData<TState, TContext>
  updatedAt: string
}

export class DynamoSessionStore<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> implements SessionStore<TState, TContext>
{
  private readonly tableName: string
  private readonly client: DynamoDBDocumentClient

  constructor(config: DynamoSessionStoreConfig) {
    this.tableName = config.tableName
    const baseClient = new DynamoDBClient({
      region: config.region ?? process.env.AWS_REGION ?? 'us-east-1',
    })
    this.client = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: { removeUndefinedValues: true },
    })
  }

  async load(sessionId: string): Promise<SessionData<TState, TContext> | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { sessionId },
      }),
    )

    const item = response.Item as SessionRecord<TState, TContext> | undefined
    return item?.payload ?? null
  }

  async save(sessionId: string, data: SessionData<TState, TContext>): Promise<void> {
    const record: SessionRecord<TState, TContext> = {
      sessionId,
      payload: data,
      updatedAt: new Date().toISOString(),
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
      }),
    )
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { sessionId },
      }),
    )
  }
}
