import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { env } from '../config/env'

export type IdempotencyScope = 'consent_webhook' | 'payment_webhook' | 'telegram_update' | 'ingest_upload'

interface IdempotencyStore {
  has(scope: IdempotencyScope, key: string): Promise<boolean>
  mark(scope: IdempotencyScope, key: string): Promise<void>
}

class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Set<string>()

  async has(scope: IdempotencyScope, key: string): Promise<boolean> {
    return this.seen.has(`${scope}:${key}`)
  }

  async mark(scope: IdempotencyScope, key: string): Promise<void> {
    this.seen.add(`${scope}:${key}`)
  }
}

class DynamoIdempotencyStore implements IdempotencyStore {
  private readonly tableName: string
  private readonly client: DynamoDBDocumentClient

  constructor(tableName: string) {
    this.tableName = tableName
    const baseClient = new DynamoDBClient({ region: env.awsRegion })
    this.client = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: { removeUndefinedValues: true },
    })
  }

  async has(scope: IdempotencyScope, key: string): Promise<boolean> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `${scope}:${key}` },
      }),
    )
    return Boolean(response.Item)
  }

  async mark(scope: IdempotencyScope, key: string): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `${scope}:${key}`,
          scope,
          key,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    )
  }
}

let sharedStore: IdempotencyStore | null = null

export function getIdempotencyStore(): IdempotencyStore {
  if (sharedStore) {
    return sharedStore
  }
  if (env.dynamoIdempotencyTable) {
    sharedStore = new DynamoIdempotencyStore(env.dynamoIdempotencyTable)
    return sharedStore
  }
  sharedStore = new MemoryIdempotencyStore()
  return sharedStore
}
