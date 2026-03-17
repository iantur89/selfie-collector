import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PersistArtifactInputSchema, PersistArtifactOutputSchema } from '../../contracts/tools'
import { env } from '../config/env'

const s3Client = new S3Client({ region: env.awsRegion })

export async function persistArtifact(input: unknown) {
  const parsed = PersistArtifactInputSchema.parse(input)
  const body = Buffer.from(parsed.bytesBase64, 'base64')

  if (!env.s3Bucket || parsed.bucket === 'memory') {
    return PersistArtifactOutputSchema.parse({
      status: 'success',
      bucket: parsed.bucket,
      key: parsed.key,
      etag: 'memory-etag',
    })
  }

  const response = await s3Client.send(
    new PutObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
      Body: body,
      ContentType: parsed.contentType,
      Metadata: parsed.metadata,
    }),
  )

  return PersistArtifactOutputSchema.parse({
    status: 'success',
    bucket: parsed.bucket,
    key: parsed.key,
    etag: response.ETag,
  })
}
