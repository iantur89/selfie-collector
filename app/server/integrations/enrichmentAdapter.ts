import { TagSelfieInputSchema, TagSelfieOutputSchema } from '../../contracts/tools'

function deterministicValue(seed: string, items: string[]): string {
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return items[hash % items.length]
}

export async function tagSelfie(input: unknown) {
  const parsed = TagSelfieInputSchema.parse(input)
  const seed = `${parsed.sessionId}:${parsed.userId}:${parsed.selfieS3Key}`

  return TagSelfieOutputSchema.parse({
    status: 'success',
    tags: {
      demographics: [deterministicValue(seed, ['african_american', 'asian', 'latino', 'white', 'unknown'])],
      gender: deterministicValue(seed, ['female', 'male', 'non_binary', 'unknown']),
      lighting: deterministicValue(seed, ['dark', 'normal', 'bright']),
      angle: deterministicValue(seed, ['frontal', 'left', 'right', 'up', 'down', 'high_angle', 'low_angle']),
      quality: {
        blurScore: 0.1 + ((seed.length % 6) * 0.1),
        occluded: seed.length % 2 === 0,
        resolutionBucket: deterministicValue(seed, ['low', 'medium', 'high']),
      },
    },
    confidence: 0.78,
    modelName: 'open-source-ensemble',
    modelVersion: '1.0.0',
  })
}
