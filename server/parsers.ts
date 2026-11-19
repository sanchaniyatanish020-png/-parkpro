import type { AuditLog, Direction, LogKind, Pass, ScanEvent, ScanOutcome, WalkIn } from '../src/types'
import { normalizePlate, uid } from '../src/lib/utils'
import { oneOf, optionalStr, str, isoDate, asObject, fail } from './validate'

const VEHICLE_TYPES = ['car', 'suv', 'bike', 'ev'] as const
const PLANS = ['daily', 'monthly', 'quarterly', 'half_yearly', 'yearly'] as const
const DIRECTIONS = ['IN', 'OUT', 'DENIED'] as const
const OUTCOMES = ['success', 'expiring', 'expired', 'unknown'] as const
const SOURCES = ['camera', 'manual'] as const
const LOG_KINDS = ['scan', 'walkin', 'pass', 'sync', 'auth', 'system'] as const
const LOG_LEVELS = ['info', 'success', 'warn', 'error'] as const

const PHOTO_MAX = 3_000_000

export function parsePlate(value: unknown): string {
  const plate = normalizePlate(str(value, 'Vehicle number', { max: 20 }))
  if (plate.length < 4) fail(400, 'Vehicle number is too short')
  return plate
}

export function parsePhone(value: unknown): string {
  const digits = str(value, 'Phone number', { max: 20 }).replace(/\D/g, '')
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) fail(400, 'Phone number must be a valid 10-digit mobile')
  return digits
}

export function parsePassBody(body: Record<string, unknown>, existing?: Pass): Pass {
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? optionalStr(body.id, 'id', 64) ?? uid('p_'),
    token: existing?.token ?? optionalStr(body.token, 'Token', 32)?.toUpperCase() ?? '',
    name: str(body.name ?? existing?.name, 'Name', { max: 80 }),
    phone: parsePhone(body.phone ?? existing?.phone),
    vehicle: parsePlate(body.vehicle ?? existing?.vehicle),
    vehicleType: oneOf(body.vehicleType ?? existing?.vehicleType, 'Vehicle type', VEHICLE_TYPES),
    plan: oneOf(body.plan ?? existing?.plan, 'Plan', PLANS),
    startDate: isoDate(body.startDate ?? existing?.startDate, 'Start date'),
    endDate: isoDate(body.endDate ?? existing?.endDate, 'End date'),
    amount: Number(body.amount ?? existing?.amount ?? 0),
    slot: optionalStr(body.slot, 'Slot', 20) ?? existing?.slot,
    photo: optionalStr(body.photo, 'Photo', PHOTO_MAX) ?? existing?.photo,
    notes: optionalStr(body.notes, 'Notes', 300) ?? existing?.notes,
    createdAt: existing?.createdAt ?? optionalStr(body.createdAt, 'Created at', 40) ?? now,
    updatedAt: now,
  }
}

export function parseScanBody(value: unknown): ScanEvent {
  const body = asObject(value)
  return {
    id: optionalStr(body.id, 'id', 64) ?? uid('s_'),
    passId: optionalStr(body.passId, 'Pass id', 64),
    token: optionalStr(body.token, 'Token', 500),
    name: optionalStr(body.name, 'Name', 80),
    phone: optionalStr(body.phone, 'Phone', 20),
    vehicle: optionalStr(body.vehicle, 'Vehicle', 20),
    photo: optionalStr(body.photo, 'Photo', PHOTO_MAX),
    direction: oneOf(body.direction, 'Direction', DIRECTIONS) as Direction,
    outcome: oneOf(body.outcome, 'Outcome', OUTCOMES) as ScanOutcome,
    at: isoDate(body.at, 'Scanned at'),
    source: oneOf(body.source, 'Source', SOURCES),
    synced: true,
  }
}

export function parseWalkInBody(value: unknown): WalkIn {
  const body = asObject(value)
  const at = isoDate(body.at ?? new Date().toISOString(), 'At')
  return {
    id: optionalStr(body.id, 'id', 64) ?? uid('w_'),
    name: str(body.name, 'Name', { max: 80 }),
    phone: parsePhone(body.phone),
    vehicle: body.vehicle ? parsePlate(body.vehicle) : undefined,
    vehicleType: oneOf(body.vehicleType, 'Vehicle type', VEHICLE_TYPES),
    photo: optionalStr(body.photo, 'Photo', PHOTO_MAX),
    amount: Number(body.amount ?? 0),
    at,
    synced: true,
  }
}

export function parseLogBody(value: unknown): AuditLog {
  const body = asObject(value)
  const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
    ? (body.meta as AuditLog['meta'])
    : undefined
  return {
    id: optionalStr(body.id, 'id', 64) ?? uid('log_'),
    kind: oneOf(body.kind, 'Log kind', LOG_KINDS) as LogKind,
    message: str(body.message, 'Message', { max: 400 }),
    at: isoDate(body.at ?? new Date().toISOString(), 'At'),
    level: oneOf(body.level ?? 'info', 'Level', LOG_LEVELS),
    meta,
  }
}
