type LogLevel = 'info' | 'warn' | 'error'

export function log(level: LogLevel, message: string, metadata: Record<string, unknown> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  }
  const serialized = JSON.stringify(payload)
  if (level === 'error') {
    console.error(serialized)
    return
  }
  if (level === 'warn') {
    console.warn(serialized)
    return
  }
  console.log(serialized)
}
