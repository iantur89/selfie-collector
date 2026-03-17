type Task<T> = () => Promise<T>

const sessionQueue = new Map<string, Promise<unknown>>()

export async function withSessionLock<T>(sessionId: string, task: Task<T>): Promise<T> {
  const previous = sessionQueue.get(sessionId) ?? Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(() => task())
    .finally(() => {
      if (sessionQueue.get(sessionId) === current) {
        sessionQueue.delete(sessionId)
      }
    })

  sessionQueue.set(sessionId, current)
  return current
}
