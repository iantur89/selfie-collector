import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { env } from '../config/env'

const sqsClient = new SQSClient({ region: env.awsRegion })
const inMemoryQueue: unknown[] = []

export interface EnrichmentJob {
  sessionId: string
  userId: string
  selfieId: string
  selfieS3Key: string
}

export async function enqueueEnrichmentJob(job: EnrichmentJob) {
  const queueUrl = process.env.ENRICHMENT_QUEUE_URL
  if (!queueUrl) {
    inMemoryQueue.push(job)
    return
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
    }),
  )
}

export function drainInMemoryEnrichmentQueue() {
  const jobs = [...inMemoryQueue] as EnrichmentJob[]
  inMemoryQueue.length = 0
  return jobs
}
