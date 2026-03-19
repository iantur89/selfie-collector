import { CompareFacesCommand, DetectFacesCommand, RekognitionClient } from '@aws-sdk/client-rekognition'
import { ValidateSelfieInputSchema, ValidateSelfieOutputSchema } from '../../contracts/tools'
import { env } from '../config/env'

const rekognitionClient = new RekognitionClient({ region: env.awsRegion })
const FACE_MATCH_THRESHOLD = 85

function getBucket(): string | null {
  const bucket = env.s3Bucket
  if (!bucket || bucket === 'memory') return null
  return bucket
}

function mapLighting(brightness?: number): 'dark' | 'normal' | 'bright' {
  if (brightness == null) return 'normal'
  if (brightness < 35) return 'dark'
  if (brightness > 65) return 'bright'
  return 'normal'
}

function mapFaceAngle(yaw?: number, pitch?: number): 'frontal' | 'left' | 'right' | 'up' | 'down' {
  const absYaw = Math.abs(yaw ?? 0)
  const absPitch = Math.abs(pitch ?? 0)
  if (absYaw < 15 && absPitch < 15) return 'frontal'
  if (absYaw >= absPitch) return (yaw ?? 0) >= 0 ? 'right' : 'left'
  return (pitch ?? 0) >= 0 ? 'down' : 'up'
}

function mapCameraAngle(pitch?: number): 'eye_level' | 'high_angle' | 'low_angle' | 'unknown' {
  if (pitch == null) return 'unknown'
  if (pitch > 12) return 'low_angle'
  if (pitch < -12) return 'high_angle'
  return 'eye_level'
}

function mapAgeGroup(low?: number, high?: number): 'minor' | 'young_adult' | 'adult' | 'middle_aged' | 'senior' | 'unknown' {
  if (low == null && high == null) return 'unknown'
  const midpoint = ((low ?? high ?? 0) + (high ?? low ?? 0)) / 2
  if (midpoint < 18) return 'minor'
  if (midpoint < 30) return 'young_adult'
  if (midpoint < 45) return 'adult'
  if (midpoint < 60) return 'middle_aged'
  return 'senior'
}

function mapResolutionBucket(sharpness?: number): 'low' | 'medium' | 'high' {
  if (sharpness == null) return 'medium'
  if (sharpness < 35) return 'low'
  if (sharpness > 70) return 'high'
  return 'medium'
}

function mapGender(value?: string, confidence?: number): 'female' | 'male' | 'non_binary' | 'unknown' {
  if ((confidence ?? 0) < 70) return 'unknown'
  const normalized = (value ?? '').toLowerCase()
  if (normalized === 'female') return 'female'
  if (normalized === 'male') return 'male'
  return 'unknown'
}

export async function validateSelfie(input: unknown) {
  const parsed = ValidateSelfieInputSchema.parse(input)
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(parsed.selfieS3Key)
  if (!isImage) {
    return ValidateSelfieOutputSchema.parse({
      status: 'success',
      accepted: false,
      reason: 'Only image files are accepted for selfie upload',
    })
  }

  const bucket = getBucket()
  if (!bucket) {
    return ValidateSelfieOutputSchema.parse({
      status: 'fatal_error',
      accepted: false,
      reason: 'S3 bucket is not configured for validation.',
      tags: {
        lighting: 'normal',
        faceAngle: 'frontal',
        cameraAngle: 'unknown',
        ageGroup: 'unknown',
        skinTone: 'unknown',
        demographic: 'unknown',
        resolutionBucket: 'medium',
        gender: 'unknown',
      },
    })
  }
  if (!parsed.referenceSelfieS3Key) {
    return ValidateSelfieOutputSchema.parse({
      status: 'fatal_error',
      accepted: false,
      reason: 'Reference selfie is missing for identity match validation.',
      tags: {
        lighting: 'normal',
        faceAngle: 'frontal',
        cameraAngle: 'unknown',
        ageGroup: 'unknown',
        skinTone: 'unknown',
        demographic: 'unknown',
        resolutionBucket: 'medium',
        gender: 'unknown',
      },
    })
  }

  let faceMatchScore = 0
  try {
    const compare = await rekognitionClient.send(
      new CompareFacesCommand({
        SourceImage: { S3Object: { Bucket: bucket, Name: parsed.referenceSelfieS3Key } },
        TargetImage: { S3Object: { Bucket: bucket, Name: parsed.selfieS3Key } },
        SimilarityThreshold: FACE_MATCH_THRESHOLD,
      }),
    )
    faceMatchScore = (compare.FaceMatches?.[0]?.Similarity ?? 0) / 100
  } catch (err) {
    return ValidateSelfieOutputSchema.parse({
      status: 'retryable_error',
      accepted: false,
      reason: err instanceof Error ? err.message : 'Rekognition compare failed',
      tags: {
        lighting: 'normal',
        faceAngle: 'frontal',
        cameraAngle: 'unknown',
        ageGroup: 'unknown',
        skinTone: 'unknown',
        demographic: 'unknown',
        resolutionBucket: 'medium',
        gender: 'unknown',
      },
    })
  }

  try {
    const detect = await rekognitionClient.send(
      new DetectFacesCommand({
        Image: { S3Object: { Bucket: bucket, Name: parsed.selfieS3Key } },
        Attributes: ['ALL'],
      }),
    )
    const detail = detect.FaceDetails?.[0]
    const brightness = detail?.Quality?.Brightness
    const sharpness = detail?.Quality?.Sharpness
    const yaw = detail?.Pose?.Yaw
    const pitch = detail?.Pose?.Pitch
    const low = detail?.AgeRange?.Low
    const high = detail?.AgeRange?.High
    const occluded = detail?.FaceOccluded?.Value
    const gender = mapGender(detail?.Gender?.Value, detail?.Gender?.Confidence)

    const accepted = faceMatchScore >= FACE_MATCH_THRESHOLD / 100

    return ValidateSelfieOutputSchema.parse({
      status: 'success',
      accepted,
      reason: accepted ? undefined : 'Face does not match the verified reference selfie.',
      tags: {
        lighting: mapLighting(brightness),
        faceAngle: mapFaceAngle(yaw, pitch),
        cameraAngle: mapCameraAngle(pitch),
        ageGroup: mapAgeGroup(low, high),
        // Rekognition does not provide skin tone or ethnicity attributes directly.
        skinTone: 'unknown',
        demographic: 'unknown',
        resolutionBucket: mapResolutionBucket(sharpness),
        gender,
        blurScore: sharpness == null ? undefined : Math.max(0, Math.min(1, 1 - sharpness / 100)),
        occluded: occluded ?? undefined,
        faceMatchScore,
      },
    })
  } catch (err) {
    return ValidateSelfieOutputSchema.parse({
      status: 'retryable_error',
      accepted: false,
      reason: err instanceof Error ? err.message : 'Rekognition detect-faces failed',
      tags: {
        lighting: 'normal',
        faceAngle: 'frontal',
        cameraAngle: 'unknown',
        ageGroup: 'unknown',
        skinTone: 'unknown',
        demographic: 'unknown',
        resolutionBucket: 'medium',
        gender: 'unknown',
        faceMatchScore,
      },
    })
  }

}
