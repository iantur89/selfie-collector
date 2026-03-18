import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { env } from '../config/env'

export type IdempotencyScope = 'consent_webhook' | 'payment_webhook' | 'telegram_update' | 'ingest_upload'

interface IdempotencyStore {
  /**
   * Atomically claims an idempotency key.
   * Returns true if this call claimed it (first seen), false if it already existed.
   */
  claim(scope: IdempotencyScope, key: string): Promise<boolean>
}

class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Set<string>()

  async claim(scope: IdempotencyScope, key: string): Promise<boolean> {
    const composite = `${scope}:${key}`
    if (this.seen.has(composite)) {
      return false
    }
    this.seen.add(composite)
    return true
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

  async claim(scope: IdempotencyScope, key: string): Promise<boolean> {
    try {
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
      return true
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false
      }
      throw error
    }
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
