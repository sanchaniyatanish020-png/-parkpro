export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message)
}

interface StringOptions {
  min?: number
  max?: number
  optional?: boolean
}

export function str(value: unknown, field: string, options: StringOptions = {}): string {
  if (value == null || value === '') {
    if (options.optional) return ''
    fail(400, `${field} is required`)
  }
  if (typeof value !== 'string') fail(400, `${field} must be text`)
  const trimmed = value.trim()
  if (!options.optional && trimmed.length < (options.min ?? 1)) fail(400, `${field} is too short`)
  if (options.max && trimmed.length > options.max) fail(400, `${field} is too long (max ${options.max})`)
  return trimmed
}

export function optionalStr(value: unknown, field: string, max: number): string | undefined {
  if (value == null || value === '') return undefined
  return str(value, field, { max })
}

export function num(value: unknown, field: string, options: { min?: number; max?: number } = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(400, `${field} must be a number`)
  if (options.min != null && value < options.min) fail(400, `${field} must be at least ${options.min}`)
  if (options.max != null && value > options.max) fail(400, `${field} must be at most ${options.max}`)
  return value
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(400, `${field} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

export function isoDate(value: unknown, field: string): string {
  const raw = str(value, field, { max: 40 })
  if (Number.isNaN(new Date(raw).getTime())) fail(400, `${field} must be a valid date`)
  return raw
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Request body must be an object')
  return value as Record<string, unknown>
}
