import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { getCollectorSessionData } from '@server/a3/session'
import { env } from '@server/config/env'
import { listDatasetRecordsBySession } from '@server/metadata/repository'

export type UserSessionSummary = {
  sessionId: string
  updatedAt: string | null
  activeAgentId: string | null
  userId: string | null
  telegramUserId: string | null
  workflowStage: string | null
  verificationStatus: string | null
  name: string | null
  selfieCount: number | null
}

type SessionTableItem = {
  sessionId?: string
  updatedAt?: string
  payload?: {
    activeAgentId?: string
    state?: {
      name?: string
      telegramUserId?: string
      workflowStage?: string
      verificationStatus?: string
      selfieCount?: number
    }
  }
}

let dynamoClient: DynamoDBDocumentClient | null = null

function getDynamoClient() {
  if (dynamoClient) return dynamoClient
  const base = new DynamoDBClient({ region: env.awsRegion })
  dynamoClient = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  })
  return dynamoClient
}

function toSummary(item: SessionTableItem): UserSessionSummary | null {
  const sessionId = item.sessionId
  if (!sessionId || !sessionId.startsWith('tg-')) return null

  const state = item.payload?.state
  return {
    sessionId,
    updatedAt: item.updatedAt ?? null,
    activeAgentId: item.payload?.activeAgentId ?? null,
    userId: state?.telegramUserId ?? sessionId.replace(/^tg-/, ''),
    telegramUserId: state?.telegramUserId ?? null,
    workflowStage: state?.workflowStage ?? null,
    verificationStatus: state?.verificationStatus ?? null,
    name: state?.name ?? null,
    selfieCount: typeof state?.selfieCount === 'number' ? state.selfieCount : null,
  }
}

export async function listUserSessions(search?: string): Promise<UserSessionSummary[]> {
  if (!env.dynamoSessionTable) {
    return []
  }

  const client = getDynamoClient()
  const items: UserSessionSummary[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const response = await client.send(
      new ScanCommand({
        TableName: env.dynamoSessionTable,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 250,
      }),
    )

    for (const item of (response.Items ?? []) as SessionTableItem[]) {
      const summary = toSummary(item)
      if (!summary) continue
      items.push(summary)
    }

    lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastEvaluatedKey && items.length < 1000)

  const lowered = search?.trim().toLowerCase()
  const filtered = lowered
    ? items.filter((item) =>
        [item.sessionId, item.userId, item.telegramUserId, item.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(lowered)),
      )
    : items

  return filtered.sort((a, b) => {
    const left = a.updatedAt ? Date.parse(a.updatedAt) : 0
    const right = b.updatedAt ? Date.parse(b.updatedAt) : 0
    return right - left
  })
}

export async function getUserSessionDetail(sessionId: string) {
  const sessionData = await getCollectorSessionData(sessionId)
  const datasetRecords = await listDatasetRecordsBySession(sessionId)
  return {
    sessionId,
    activeAgentId: sessionData?.activeAgentId ?? null,
    state: sessionData?.state ?? null,
    rawSession: sessionData ?? null,
    datasetRecords,
  }
}
