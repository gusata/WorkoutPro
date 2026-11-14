export interface LocalErrorRecord {
  id: string
  scope: string
  message: string
  occurredAt: string
  context: Record<string, string | number | boolean | null>
}

const STORAGE_KEY = 'workoutpro.error-log.v1'
const MAX_RECORDS = 25

function sanitize(value: unknown) {
  const text = value instanceof Error ? value.message : String(value ?? 'Falha desconhecida')
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/(token|key|secret|authorization)[=: ]+\S+/gi, '$1=[redacted]')
    .slice(0, 240)
}

function safeContext(context: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 10)
      .map(([key, value]) => [key.slice(0, 40), typeof value === 'string' ? value.slice(0, 100) : value as number | boolean | null])
  )
}

export function getLocalErrorLog(): LocalErrorRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECORDS) : []
  } catch {
    return []
  }
}

export function clearLocalErrorLog() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
}

export function reportError(scope: string, error: unknown, context: Record<string, unknown> = {}) {
  const record: LocalErrorRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scope: scope.slice(0, 60),
    message: sanitize(error),
    occurredAt: new Date().toISOString(),
    context: safeContext(context),
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...getLocalErrorLog()].slice(0, MAX_RECORDS)))
      window.dispatchEvent(new CustomEvent<LocalErrorRecord>('workoutpro:error-recorded', { detail: record }))
    } catch {
      // Diagnostics are best-effort and can never interrupt the primary action.
    }
  }

  if (process.env.NODE_ENV === 'development') console.error(`[WorkoutPro:${record.scope}]`, error)
  return record.id
}
