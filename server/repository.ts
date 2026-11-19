import type { StatementSync } from 'node:sqlite'
import type { AuditLog, LogKind, Pass, ScanEvent, WalkIn } from '../src/types'
import { normalizePlate } from '../src/lib/utils'
import { db } from './db'

// Re-preparing a fixed SQL string on every call burns parse time in the scan
// path; the statements are immutable so they can be reused.
const prepared = new Map<string, StatementSync>()
function stmt(sql: string): StatementSync {
  let statement = prepared.get(sql)
  if (!statement) {
    statement = db.prepare(sql)
    prepared.set(sql, statement)
  }
  return statement
}

export interface SiteRecord {
  name: string
  capacity: number
}

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  role: 'owner' | 'staff'
  name: string
  createdAt: string
}

type Row = Record<string, string | number | null>

function toPass(row: Row): Pass {
  return {
    id: String(row.id),
    token: String(row.token),
    name: String(row.name),
    phone: String(row.phone),
    vehicle: String(row.vehicle),
    vehicleType: row.vehicle_type as Pass['vehicleType'],
    plan: row.plan as Pass['plan'],
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    amount: Number(row.amount),
    slot: row.slot == null ? undefined : String(row.slot),
    photo: row.photo == null ? undefined : String(row.photo),
    notes: row.notes == null ? undefined : String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toScan(row: Row): ScanEvent {
  return {
    id: String(row.id),
    passId: row.pass_id == null ? undefined : String(row.pass_id),
    token: row.token == null ? undefined : String(row.token),
    name: row.name == null ? undefined : String(row.name),
    phone: row.phone == null ? undefined : String(row.phone),
    vehicle: row.vehicle == null ? undefined : String(row.vehicle),
    photo: row.photo == null ? undefined : String(row.photo),
    direction: row.direction as ScanEvent['direction'],
    outcome: row.outcome as ScanEvent['outcome'],
    at: String(row.at),
    source: row.source as ScanEvent['source'],
    synced: Boolean(Number(row.synced)),
  }
}

function toWalkIn(row: Row): WalkIn {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    vehicle: row.vehicle == null ? undefined : String(row.vehicle),
    vehicleType: row.vehicle_type as WalkIn['vehicleType'],
    photo: row.photo == null ? undefined : String(row.photo),
    amount: Number(row.amount),
    at: String(row.at),
    synced: Boolean(Number(row.synced)),
  }
}

function toLog(row: Row): AuditLog {
  let meta: AuditLog['meta']
  if (row.meta) {
    try {
      meta = JSON.parse(String(row.meta)) as AuditLog['meta']
    } catch {
      meta = undefined
    }
  }
  return {
    id: String(row.id),
    kind: row.kind as LogKind,
    message: String(row.message),
    at: String(row.at),
    level: row.level as AuditLog['level'],
    meta,
  }
}

/* --------------------------------- passes --------------------------------- */

export function listPasses(): Pass[] {
  return (stmt('SELECT * FROM passes ORDER BY created_at DESC').all() as Row[]).map(toPass)
}

export function getPass(id: string): Pass | null {
  const row = stmt('SELECT * FROM passes WHERE id = ?').get(id) as Row | undefined
  return row ? toPass(row) : null
}

export function upsertPass(pass: Pass): void {
  stmt(
    `INSERT INTO passes (id, token, name, phone, vehicle, vehicle_type, plan, start_date, end_date,
       amount, slot, photo, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       token = excluded.token, name = excluded.name, phone = excluded.phone, vehicle = excluded.vehicle,
       vehicle_type = excluded.vehicle_type, plan = excluded.plan, start_date = excluded.start_date,
       end_date = excluded.end_date, amount = excluded.amount, slot = excluded.slot, photo = excluded.photo,
       notes = excluded.notes, updated_at = excluded.updated_at`,
  ).run(
    pass.id,
    pass.token,
    pass.name,
    pass.phone,
    pass.vehicle,
    pass.vehicleType,
    pass.plan,
    pass.startDate,
    pass.endDate,
    pass.amount,
    pass.slot ?? null,
    pass.photo ?? null,
    pass.notes ?? null,
    pass.createdAt,
    pass.updatedAt,
  )
}

export function deletePass(id: string): boolean {
  const result = stmt('DELETE FROM passes WHERE id = ?').run(id)
  return Number(result.changes) > 0
}

export function tokenExists(token: string, excludeId?: string): boolean {
  const row = excludeId
    ? stmt('SELECT 1 FROM passes WHERE token = ? AND id <> ?').get(token, excludeId)
    : stmt('SELECT 1 FROM passes WHERE token = ?').get(token)
  return Boolean(row)
}

export function tokenFromPayload(text: string): string {
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const param = url.searchParams.get('p') ?? url.searchParams.get('token') ?? url.searchParams.get('pass')
      if (param) return param.toUpperCase()
      const last = url.pathname.split('/').filter(Boolean).pop()
      if (last) return last.toUpperCase()
    } catch {
      /* treat as raw text */
    }
  }
  return trimmed.toUpperCase().replace(/\s+/g, '')
}

export function findPassByQuery(query: string): Pass | null {
  const raw = query.trim()
  if (!raw) return null
  const token = tokenFromPayload(raw)
  const tokenRow = stmt('SELECT * FROM passes WHERE token = ?').get(token) as Row | undefined
  if (tokenRow) return toPass(tokenRow)

  const byVehicle = db
    .prepare('SELECT * FROM passes WHERE vehicle = ?')
    .get(normalizePlate(raw)) as Row | undefined
  if (byVehicle) return toPass(byVehicle)

  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 10) {
    const phoneRow = stmt('SELECT * FROM passes WHERE phone = ?').get(digits.slice(-10)) as Row | undefined
    if (phoneRow) return toPass(phoneRow)
  }
  return null
}

/* ---------------------------------- scans --------------------------------- */

export function listScans(limit = 5000): ScanEvent[] {
  return (stmt('SELECT * FROM scans ORDER BY at DESC LIMIT ?').all(limit) as Row[]).map(toScan)
}

export function upsertScan(scan: ScanEvent): void {
  stmt(
    `INSERT INTO scans (id, pass_id, token, name, phone, vehicle, photo, direction, outcome, at, source, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       direction = excluded.direction, outcome = excluded.outcome, synced = excluded.synced`,
  ).run(
    scan.id,
    scan.passId ?? null,
    scan.token ?? null,
    scan.name ?? null,
    scan.phone ?? null,
    scan.vehicle ?? null,
    scan.photo ?? null,
    scan.direction,
    scan.outcome,
    scan.at,
    scan.source,
    scan.synced ? 1 : 0,
  )
}

export function lastRealScan(passId: string): ScanEvent | null {
  const row = db
    .prepare("SELECT * FROM scans WHERE pass_id = ? AND direction <> 'DENIED' ORDER BY at DESC LIMIT 1")
    .get(passId) as Row | undefined
  return row ? toScan(row) : null
}

/* --------------------------------- walk-ins -------------------------------- */

export function listWalkIns(): WalkIn[] {
  return (stmt('SELECT * FROM walkins ORDER BY at DESC').all() as Row[]).map(toWalkIn)
}

export function upsertWalkIn(entry: WalkIn): void {
  stmt(
    `INSERT INTO walkins (id, name, phone, vehicle, vehicle_type, photo, amount, at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET synced = excluded.synced`,
  ).run(
    entry.id,
    entry.name,
    entry.phone,
    entry.vehicle ?? null,
    entry.vehicleType,
    entry.photo ?? null,
    entry.amount,
    entry.at,
    entry.synced ? 1 : 0,
  )
}

/* ----------------------------------- logs ---------------------------------- */

export function listLogs(limit = 500): AuditLog[] {
  return (stmt('SELECT * FROM logs ORDER BY at DESC LIMIT ?').all(limit) as Row[]).map(toLog)
}

export function insertLog(log: AuditLog): void {
  stmt(
    `INSERT INTO logs (id, kind, message, at, level, meta) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET message = excluded.message`,
  ).run(log.id, log.kind, log.message, log.at, log.level, log.meta ? JSON.stringify(log.meta) : null)
}

export function clearLogs(): void {
  db.exec('DELETE FROM logs')
}

/* ----------------------------------- site ---------------------------------- */

export function getSite(): SiteRecord {
  const row = stmt('SELECT name, capacity FROM site WHERE id = 1').get() as Row | undefined
  if (!row) return { name: 'Riverfront Parking', capacity: 120 }
  return { name: String(row.name), capacity: Number(row.capacity) }
}

export function updateSite(patch: Partial<SiteRecord>): SiteRecord {
  const current = getSite()
  const next: SiteRecord = {
    name: patch.name?.trim() || current.name,
    capacity: patch.capacity && patch.capacity > 0 ? Math.round(patch.capacity) : current.capacity,
  }
  stmt(
    `INSERT INTO site (id, name, capacity, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, capacity = excluded.capacity, updated_at = excluded.updated_at`,
  ).run(next.name, next.capacity, new Date().toISOString())
  return next
}

/* ---------------------------------- users ---------------------------------- */

export function countUsers(): number {
  const row = stmt('SELECT COUNT(*) AS count FROM users').get() as Row
  return Number(row.count)
}

export function findUserByUsername(username: string): UserRecord | null {
  const clean = username.trim().toLowerCase()
  const alias =
    clean === 'bhavesh' || clean === 'bhavesh porva' || clean.startsWith('admin@') || clean === 'owner'
      ? 'admin'
      : clean.startsWith('staff@') || clean === 'gatestaff'
        ? 'staff'
        : clean
  const row = stmt('SELECT * FROM users WHERE LOWER(username) = ?').get(alias) as Row | undefined
  return row ? toUser(row) : null
}

export function findUserById(id: string): UserRecord | null {
  const row = stmt('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined
  return row ? toUser(row) : null
}

function toUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    role: row.role as UserRecord['role'],
    name: String(row.name),
    createdAt: String(row.created_at),
  }
}

export function insertUser(user: UserRecord): void {
  stmt('INSERT INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    user.id,
    user.username,
    user.passwordHash,
    user.role,
    user.name,
    user.createdAt,
  )
}

export function updateUserPassword(id: string, passwordHash: string): void {
  stmt('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

/* ---------------------------------- reset ---------------------------------- */

export function clearAllData(): void {
  db.exec('DELETE FROM scans; DELETE FROM walkins; DELETE FROM passes; DELETE FROM logs;')
}
