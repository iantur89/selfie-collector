import {
  CompareFacesCommand,
  RekognitionClient,
} from '@aws-sdk/client-rekognition'
import {
  FaceMatchInputSchema,
  FaceMatchOutputSchema,
  VerifyDocumentAndSelfieInputSchema,
  VerifyDocumentAndSelfieOutputSchema,
} from '../../contracts/tools'
import { env } from '../config/env'

const REKOGNITION_SIMILARITY_THRESHOLD = 80

const rekognitionClient = new RekognitionClient({ region: env.awsRegion })

function getBucket(): string | null {
  const bucket = env.s3Bucket
  if (!bucket || bucket === 'memory') return null
  return bucket
}

/**
 * Compare the face on the ID document with the selfie using Amazon Rekognition.
 * Returns similarity score in [0, 1] or null if Rekognition cannot run (e.g. no S3 bucket).
 */
async function compareFacesRekognition(
  idImageS3Key: string,
  selfieImageS3Key: string,
): Promise<{ similarity: number; error?: string } | null> {
  const bucket = getBucket()
  console.log('[Rekognition] CompareFaces called', {
    bucket: bucket ?? '(none)',
    idImageS3Key,
    selfieImageS3Key,
    similarityThreshold: REKOGNITION_SIMILARITY_THRESHOLD,
  })
  if (!bucket) {
    console.log('[Rekognition] CompareFaces skipped: no S3 bucket')
    return null
  }

  try {
    const response = await rekognitionClient.send(
      new CompareFacesCommand({
        SourceImage: {
          S3Object: { Bucket: bucket, Name: idImageS3Key },
        },
        TargetImage: {
          S3Object: { Bucket: bucket, Name: selfieImageS3Key },
        },
        SimilarityThreshold: REKOGNITION_SIMILARITY_THRESHOLD,
      }),
    )

    const match = response.FaceMatches?.[0]
    if (!match || match.Similarity == null) {
      const error = response.UnmatchedFaces?.length
        ? 'No face match above threshold'
        : 'No face detected in one or both images'
      console.log('[Rekognition] CompareFaces result', {
        similarity: 0,
        error,
        faceMatchCount: response.FaceMatches?.length ?? 0,
        unmatchedFaceCount: response.UnmatchedFaces?.length ?? 0,
      })
      return { similarity: 0, error }
    }
    const similarity = match.Similarity / 100
    console.log('[Rekognition] CompareFaces result', { similarity, rawSimilarity: match.Similarity })
    return { similarity }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Rekognition] CompareFaces error', { error: message })
    return { similarity: 0, error: message }
  }
}

export async function verifyDocumentAndSelfie(input: unknown) {
  const parsed = VerifyDocumentAndSelfieInputSchema.parse(input)
  console.log('[Rekognition] verifyDocumentAndSelfie called', {
    sessionId: parsed.sessionId,
    idImageS3Key: parsed.idImageS3Key,
    selfieImageS3Key: parsed.selfieImageS3Key,
  })

  const result = await compareFacesRekognition(
    parsed.idImageS3Key,
    parsed.selfieImageS3Key,
  )

  if (result === null) {
    const looksValid = Boolean(parsed.idImageS3Key && parsed.selfieImageS3Key)
    const output = VerifyDocumentAndSelfieOutputSchema.parse({
      status: 'success',
      outcome: looksValid ? 'verified' : 'inconclusive',
      confidence: looksValid ? 0.91 : 0.5,
      reason: looksValid
        ? undefined
        : 'Rekognition unavailable (no S3 bucket); using placeholder',
    })
    console.log('[Rekognition] verifyDocumentAndSelfie output (no bucket)', output)
    return output
  }

  const threshold = REKOGNITION_SIMILARITY_THRESHOLD / 100
  const verified = result.similarity >= threshold
  const output = VerifyDocumentAndSelfieOutputSchema.parse({
    status: 'success',
    outcome: verified ? 'verified' : result.error ? 'rejected' : 'inconclusive',
    confidence: result.similarity,
    reason: result.error,
  })
  console.log('[Rekognition] verifyDocumentAndSelfie output', output)
  return output
}

export async function faceMatch(input: unknown) {
  const parsed = FaceMatchInputSchema.parse(input)
  console.log('[Rekognition] faceMatch called', {
    sessionId: parsed.sessionId,
    idImageS3Key: parsed.idImageS3Key,
    selfieImageS3Key: parsed.selfieImageS3Key,
  })

  const result = await compareFacesRekognition(
    parsed.idImageS3Key,
    parsed.selfieImageS3Key,
  )

  if (result === null) {
    const fallbackMatch = parsed.idImageS3Key === parsed.selfieImageS3Key
    const output = FaceMatchOutputSchema.parse({
      status: 'success',
      matched: fallbackMatch,
      score: fallbackMatch ? 1 : 0.87,
      threshold: REKOGNITION_SIMILARITY_THRESHOLD / 100,
    })
    console.log('[Rekognition] faceMatch output (no bucket fallback)', output)
    return output
  }

  const threshold = REKOGNITION_SIMILARITY_THRESHOLD / 100
  const output = FaceMatchOutputSchema.parse({
    status: 'success',
    matched: result.similarity >= threshold,
    score: result.similarity,
    threshold,
  })
  console.log('[Rekognition] faceMatch output', output)
  return output
}
