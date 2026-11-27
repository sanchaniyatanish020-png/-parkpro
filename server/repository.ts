import type { StatementSync } from 'node:sqlite'
import type { AuditLog, LogKind, Pass, ScanEvent, StaffPermissions, WalkIn } from '../src/types'
import { resolvePermissions } from '../src/lib/permissions'
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
  monthlyRate: number
  rateCar: number
  rateSuv: number
  rateBike: number
  rateEv: number
  upiId: string
  upiName: string
  remindersEnabled: boolean
  reminderDays: number
  whatsappTemplate: string
  whatsappLang: string
}

export interface ReminderRecord {
  id: string
  passId: string
  endDate: string
  channel: 'manual' | 'whatsapp' | 'click_to_chat'
  status: 'pending' | 'opened' | 'sent' | 'skipped' | 'failed'
  reminderType?: string
  message: string
  error?: string
  at: string
  byName?: string
  byUsername?: string
}

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  role: 'owner' | 'staff'
  name: string
  active: boolean
  permissions: StaffPermissions
  hourlyRate: number
  monthlySalary: number
  createdAt: string
}

export interface EmployeeSessionRecord {
  id: string
  userId: string
  loginAt: string
  logoutAt?: string
  notes?: string
}

export interface EmployeeLeaveRecord {
  id: string
  userId: string
  leaveDate: string
  leaveType: 'full' | 'half'
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  createdBy?: string
  reviewedBy?: string
  reviewedAt?: string
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
    paymentMode: (row.payment_mode as Pass['paymentMode']) || 'cash',
    transactionId: row.transaction_id == null ? undefined : String(row.transaction_id),
    collectedBy: row.collected_by == null ? undefined : String(row.collected_by),
    collectedByUsername: row.collected_by_username == null ? undefined : String(row.collected_by_username),
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
    paymentMode: (row.payment_mode as WalkIn['paymentMode']) || 'cash',
    collectedBy: row.collected_by == null ? undefined : String(row.collected_by),
    collectedByUsername: row.collected_by_username == null ? undefined : String(row.collected_by_username),
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
       amount, payment_mode, transaction_id, collected_by, collected_by_username, slot, photo, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       token = excluded.token, name = excluded.name, phone = excluded.phone, vehicle = excluded.vehicle,
       vehicle_type = excluded.vehicle_type, plan = excluded.plan, start_date = excluded.start_date,
       end_date = excluded.end_date, amount = excluded.amount, payment_mode = excluded.payment_mode,
       transaction_id = COALESCE(excluded.transaction_id, passes.transaction_id),
       collected_by = COALESCE(excluded.collected_by, passes.collected_by),
       collected_by_username = COALESCE(excluded.collected_by_username, passes.collected_by_username),
       slot = excluded.slot, photo = excluded.photo, notes = excluded.notes, updated_at = excluded.updated_at`,
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
    pass.paymentMode ?? 'cash',
    pass.transactionId ?? null,
    pass.collectedBy ?? null,
    pass.collectedByUsername ?? null,
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

/* -------------------------------- reminders -------------------------------- */

function toReminder(row: Row): ReminderRecord {
  return {
    id: String(row.id),
    passId: String(row.pass_id),
    endDate: String(row.end_date),
    channel: (row.channel as ReminderRecord['channel']) || 'manual',
    status: (row.status as ReminderRecord['status']) || 'sent',
    reminderType: row.reminder_type ? String(row.reminder_type) : undefined,
    message: String(row.message ?? ''),
    error: row.error == null ? undefined : String(row.error),
    at: String(row.at),
    byName: row.by_name == null ? undefined : String(row.by_name),
    byUsername: row.by_username == null ? undefined : String(row.by_username),
  }
}

export function listReminders(limit = 1000): ReminderRecord[] {
  return (stmt('SELECT * FROM pass_reminders ORDER BY at DESC LIMIT ?').all(limit) as Row[]).map(toReminder)
}

/** Any successful reminder for this expiry cycle means the customer was already contacted. */
export function hasSentReminder(passId: string, endDate: string, reminderType?: string): boolean {
  if (reminderType) {
    const row = stmt("SELECT 1 FROM pass_reminders WHERE pass_id = ? AND end_date = ? AND reminder_type = ? AND status = 'sent'").get(
      passId,
      endDate,
      reminderType,
    )
    return Boolean(row)
  }
  const row = stmt("SELECT 1 FROM pass_reminders WHERE pass_id = ? AND end_date = ? AND status = 'sent'").get(
    passId,
    endDate,
  )
  return Boolean(row)
}

export function recordReminder(input: {
  passId: string
  endDate: string
  channel: ReminderRecord['channel']
  status: ReminderRecord['status']
  reminderType?: string
  message: string
  error?: string
  at?: string
  byName?: string
  byUsername?: string
}): ReminderRecord {
  const at = input.at ?? new Date().toISOString()
  const reminderType = input.reminderType ?? 'expiring'
  stmt(
    `INSERT INTO pass_reminders (id, pass_id, end_date, channel, status, reminder_type, message, error, at, by_name, by_username)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pass_id, end_date, reminder_type) DO UPDATE SET
       channel = excluded.channel, status = excluded.status, message = excluded.message, error = excluded.error,
       at = excluded.at, by_name = excluded.by_name, by_username = excluded.by_username`,
  ).run(
    `rm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    input.passId,
    input.endDate,
    input.channel,
    input.status,
    reminderType,
    input.message,
    input.error ?? null,
    at,
    input.byName ?? null,
    input.byUsername ?? null,
  )
  const row = stmt('SELECT * FROM pass_reminders WHERE pass_id = ? AND end_date = ? AND reminder_type = ?').get(
    input.passId,
    input.endDate,
    reminderType,
  ) as Row
  return toReminder(row)
}

/** Returns the first active pass (end_date in future) with the given phone, excluding a pass id. */
export function findActivePassByPhone(phone: string, excludeId?: string): Pass | null {
  const clean = phone.trim().replace(/\D/g, '').slice(-10)
  if (!clean) return null
  const row = excludeId
    ? (stmt("SELECT * FROM passes WHERE phone = ? AND end_date >= date('now') AND id <> ? LIMIT 1").get(clean, excludeId) as Row | undefined)
    : (stmt("SELECT * FROM passes WHERE phone = ? AND end_date >= date('now') LIMIT 1").get(clean) as Row | undefined)
  return row ? toPass(row) : null
}

/** Returns the first active pass (end_date in future) with the given vehicle plate, excluding a pass id. */
export function findActivePassByVehicle(vehicle: string, excludeId?: string): Pass | null {
  const plate = vehicle.trim().toUpperCase().replace(/[\s-]/g, '')
  if (!plate) return null
  const row = excludeId
    ? (stmt("SELECT * FROM passes WHERE vehicle = ? AND end_date >= date('now') AND id <> ? LIMIT 1").get(plate, excludeId) as Row | undefined)
    : (stmt("SELECT * FROM passes WHERE vehicle = ? AND end_date >= date('now') LIMIT 1").get(plate) as Row | undefined)
  return row ? toPass(row) : null
}

export function tokenExists(token: string, excludeId?: string): boolean {
  const row = excludeId
    ? stmt('SELECT 1 FROM passes WHERE token = ? AND id <> ?').get(token, excludeId)
    : stmt('SELECT 1 FROM passes WHERE token = ?').get(token)
  return Boolean(row)
}

export function tokenFromPayload(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const val = parsed.token ?? parsed.pass ?? parsed.p
      if (typeof val === 'string' && val.trim()) return val.trim().toUpperCase()
    } catch {
      /* not valid JSON */
    }
  }
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
  const prkpMatch = trimmed.match(/PRKP-[A-Z0-9]+/i)
  if (prkpMatch) return prkpMatch[0].toUpperCase()
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
    `INSERT INTO walkins (id, name, phone, vehicle, vehicle_type, photo, amount, payment_mode, collected_by, collected_by_username, at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       synced = excluded.synced,
       payment_mode = excluded.payment_mode,
       collected_by = COALESCE(excluded.collected_by, walkins.collected_by),
       collected_by_username = COALESCE(excluded.collected_by_username, walkins.collected_by_username)`,
  ).run(
    entry.id,
    entry.name,
    entry.phone,
    entry.vehicle ?? null,
    entry.vehicleType,
    entry.photo ?? null,
    entry.amount,
    entry.paymentMode ?? 'cash',
    entry.collectedBy ?? null,
    entry.collectedByUsername ?? null,
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
  const row = stmt(
    'SELECT name, capacity, monthly_rate, rate_car, rate_suv, rate_bike, rate_ev, upi_id, upi_name, reminders_enabled, reminder_days, whatsapp_template, whatsapp_lang FROM site WHERE id = 1',
  ).get() as Row | undefined
  if (!row) {
    return {
      name: 'Riverfront Parking',
      capacity: 120,
      monthlyRate: 1800,
      rateCar: 1800,
      rateSuv: 1800,
      rateBike: 1200,
      rateEv: 1800,
      upiId: '',
      upiName: '',
      remindersEnabled: false,
      reminderDays: 3,
      whatsappTemplate: '',
      whatsappLang: 'en',
    }
  }
  return {
    name: String(row.name),
    capacity: Number(row.capacity),
    monthlyRate: Number(row.monthly_rate ?? 1800) || 1800,
    rateCar: Number(row.rate_car ?? 1800) || 1800,
    rateSuv: Number(row.rate_suv ?? 1800) || 1800,
    rateBike: Number(row.rate_bike ?? 1200) || 1200,
    rateEv: Number(row.rate_ev ?? 1800) || 1800,
    upiId: String(row.upi_id ?? ''),
    upiName: String(row.upi_name ?? ''),
    remindersEnabled: Boolean(Number(row.reminders_enabled ?? 0)),
    reminderDays: Number(row.reminder_days ?? 3) || 3,
    whatsappTemplate: String(row.whatsapp_template ?? ''),
    whatsappLang: String(row.whatsapp_lang ?? 'en') || 'en',
  }
}

export function updateSite(patch: Partial<SiteRecord>): SiteRecord {
  const current = getSite()
  const reminderDays =
    patch.reminderDays == null ? current.reminderDays : Math.min(14, Math.max(1, Math.round(patch.reminderDays)))
  const next: SiteRecord = {
    name: patch.name?.trim() || current.name,
    capacity: patch.capacity && patch.capacity > 0 ? Math.round(patch.capacity) : current.capacity,
    monthlyRate: patch.monthlyRate && patch.monthlyRate > 0 ? Math.round(patch.monthlyRate) : current.monthlyRate,
    rateCar: patch.rateCar && patch.rateCar > 0 ? Math.round(patch.rateCar) : current.rateCar,
    rateSuv: patch.rateSuv && patch.rateSuv > 0 ? Math.round(patch.rateSuv) : current.rateSuv,
    rateBike: patch.rateBike && patch.rateBike > 0 ? Math.round(patch.rateBike) : current.rateBike,
    rateEv: patch.rateEv && patch.rateEv > 0 ? Math.round(patch.rateEv) : current.rateEv,
    upiId: patch.upiId === undefined ? current.upiId : patch.upiId.trim().toLowerCase(),
    upiName: patch.upiName === undefined ? current.upiName : patch.upiName.trim(),
    remindersEnabled: patch.remindersEnabled === undefined ? current.remindersEnabled : patch.remindersEnabled,
    reminderDays,
    whatsappTemplate:
      patch.whatsappTemplate === undefined ? current.whatsappTemplate : patch.whatsappTemplate.trim(),
    whatsappLang: patch.whatsappLang === undefined ? current.whatsappLang : patch.whatsappLang.trim() || 'en',
  }
  stmt(
    `INSERT INTO site (id, name, capacity, monthly_rate, rate_car, rate_suv, rate_bike, rate_ev, upi_id, upi_name, reminders_enabled, reminder_days, whatsapp_template, whatsapp_lang, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, capacity = excluded.capacity, monthly_rate = excluded.monthly_rate,
       rate_car = excluded.rate_car, rate_suv = excluded.rate_suv, rate_bike = excluded.rate_bike, rate_ev = excluded.rate_ev,
       upi_id = excluded.upi_id, upi_name = excluded.upi_name,
       reminders_enabled = excluded.reminders_enabled, reminder_days = excluded.reminder_days,
       whatsapp_template = excluded.whatsapp_template, whatsapp_lang = excluded.whatsapp_lang,
       updated_at = excluded.updated_at`,
  ).run(
    next.name,
    next.capacity,
    next.monthlyRate,
    next.rateCar,
    next.rateSuv,
    next.rateBike,
    next.rateEv,
    next.upiId,
    next.upiName,
    next.remindersEnabled ? 1 : 0,
    next.reminderDays,
    next.whatsappTemplate,
    next.whatsappLang,
    new Date().toISOString(),
  )
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
  const role = row.role as UserRecord['role']
  let parsedPerms: unknown
  if (row.permissions) {
    try {
      parsedPerms = JSON.parse(String(row.permissions))
    } catch {
      parsedPerms = undefined
    }
  }
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    role,
    name: String(row.name),
    active: row.active == null ? true : Boolean(Number(row.active)),
    permissions: resolvePermissions(role, parsedPerms),
    hourlyRate: row.hourly_rate == null ? 0 : Number(row.hourly_rate),
    monthlySalary: row.monthly_salary == null ? 0 : Number(row.monthly_salary),
    createdAt: String(row.created_at),
  }
}

export function listStaffUsers(): UserRecord[] {
  return (stmt("SELECT * FROM users WHERE role = 'staff' ORDER BY active DESC, created_at DESC").all() as Row[]).map(toUser)
}

export function insertUser(user: UserRecord): void {
  stmt(
    'INSERT INTO users (id, username, password_hash, role, name, active, permissions, hourly_rate, monthly_salary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    user.id,
    user.username,
    user.passwordHash,
    user.role,
    user.name,
    user.active ? 1 : 0,
    JSON.stringify(user.permissions),
    user.hourlyRate ?? 0,
    user.monthlySalary ?? 0,
    user.createdAt,
  )
}

export function setUserActive(id: string, active: boolean): UserRecord | null {
  const result = stmt("UPDATE users SET active = ? WHERE id = ? AND role = 'staff'").run(active ? 1 : 0, id)
  if (Number(result.changes) === 0) return null
  return findUserById(id)
}

export function updateUserPermissions(id: string, permissions: StaffPermissions): UserRecord | null {
  const result = stmt("UPDATE users SET permissions = ? WHERE id = ? AND role = 'staff'").run(
    JSON.stringify(permissions),
    id,
  )
  if (Number(result.changes) === 0) return null
  return findUserById(id)
}

export function updateUserHourlyRate(id: string, hourlyRate: number): UserRecord | null {
  const result = stmt("UPDATE users SET hourly_rate = ? WHERE id = ? AND role = 'staff'").run(hourlyRate, id)
  if (Number(result.changes) === 0) return null
  return findUserById(id)
}

export function updateUserMonthlySalary(id: string, monthlySalary: number): UserRecord | null {
  const result = stmt("UPDATE users SET monthly_salary = ? WHERE id = ? AND role = 'staff'").run(monthlySalary, id)
  if (Number(result.changes) === 0) return null
  return findUserById(id)
}

export function updateUserPassword(id: string, passwordHash: string): void {
  stmt('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

/* ---------------------------- employee attendance -------------------------- */

function toSession(row: Row): EmployeeSessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    loginAt: String(row.login_at),
    logoutAt: row.logout_at == null ? undefined : String(row.logout_at),
    notes: row.notes == null ? undefined : String(row.notes),
  }
}

function toLeave(row: Row): EmployeeLeaveRecord {
  const status = row.status === 'pending' || row.status === 'rejected' ? row.status : 'approved'
  return {
    id: String(row.id),
    userId: String(row.user_id),
    leaveDate: String(row.leave_date),
    leaveType: row.leave_type === 'half' ? 'half' : 'full',
    status,
    reason: row.reason == null ? undefined : String(row.reason),
    createdBy: row.created_by == null ? undefined : String(row.created_by),
    reviewedBy: row.reviewed_by == null ? undefined : String(row.reviewed_by),
    reviewedAt: row.reviewed_at == null ? undefined : String(row.reviewed_at),
    createdAt: String(row.created_at),
  }
}

export function recordEmployeeLogin(userId: string, at = new Date().toISOString()): EmployeeSessionRecord {
  stmt('UPDATE employee_sessions SET logout_at = ? WHERE user_id = ? AND logout_at IS NULL').run(at, userId)
  const id = `es_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  stmt('INSERT INTO employee_sessions (id, user_id, login_at) VALUES (?, ?, ?)').run(id, userId, at)
  return { id, userId, loginAt: at }
}

export function recordEmployeeLogout(userId: string, at = new Date().toISOString()): void {
  const open = stmt(
    'SELECT id FROM employee_sessions WHERE user_id = ? AND logout_at IS NULL ORDER BY login_at DESC LIMIT 1',
  ).get(userId) as Row | undefined
  if (open) {
    stmt('UPDATE employee_sessions SET logout_at = ? WHERE id = ?').run(at, String(open.id))
  }
}

export function listEmployeeSessions(userId: string): EmployeeSessionRecord[] {
  return (
    stmt('SELECT * FROM employee_sessions WHERE user_id = ? ORDER BY login_at DESC').all(userId) as Row[]
  ).map(toSession)
}

export function listAllEmployeeSessions(): EmployeeSessionRecord[] {
  return (stmt('SELECT * FROM employee_sessions ORDER BY login_at DESC').all() as Row[]).map(toSession)
}

export function updateEmployeeSessionLogout(
  sessionId: string,
  userId: string,
  logoutAt: string,
): EmployeeSessionRecord | null {
  const result = stmt('UPDATE employee_sessions SET logout_at = ? WHERE id = ? AND user_id = ?').run(
    logoutAt,
    sessionId,
    userId,
  )
  if (Number(result.changes) === 0) return null
  const row = stmt('SELECT * FROM employee_sessions WHERE id = ?').get(sessionId) as Row | undefined
  return row ? toSession(row) : null
}

export function listEmployeeLeaves(userId: string): EmployeeLeaveRecord[] {
  return (
    stmt('SELECT * FROM employee_leaves WHERE user_id = ? ORDER BY leave_date DESC').all(userId) as Row[]
  ).map(toLeave)
}

export function listAllEmployeeLeaves(): EmployeeLeaveRecord[] {
  return (stmt('SELECT * FROM employee_leaves ORDER BY leave_date DESC').all() as Row[]).map(toLeave)
}

export function upsertEmployeeLeave(leave: EmployeeLeaveRecord): EmployeeLeaveRecord {
  stmt(
    `INSERT INTO employee_leaves (id, user_id, leave_date, leave_type, status, reason, created_by, reviewed_by, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, leave_date) DO UPDATE SET
       leave_type = excluded.leave_type,
       status = excluded.status,
       reason = excluded.reason,
       created_by = excluded.created_by,
       reviewed_by = excluded.reviewed_by,
       reviewed_at = excluded.reviewed_at`,
  ).run(
    leave.id,
    leave.userId,
    leave.leaveDate,
    leave.leaveType,
    leave.status,
    leave.reason ?? null,
    leave.createdBy ?? null,
    leave.reviewedBy ?? null,
    leave.reviewedAt ?? null,
    leave.createdAt,
  )
  const row = stmt('SELECT * FROM employee_leaves WHERE user_id = ? AND leave_date = ?').get(
    leave.userId,
    leave.leaveDate,
  ) as Row
  return toLeave(row)
}

export function updateEmployeeLeaveStatus(
  leaveId: string,
  userId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
): EmployeeLeaveRecord | null {
  const reviewedAt = new Date().toISOString()
  const result = stmt(
    'UPDATE employee_leaves SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND user_id = ?',
  ).run(status, reviewedBy, reviewedAt, leaveId, userId)
  if (Number(result.changes) === 0) return null
  const row = stmt('SELECT * FROM employee_leaves WHERE id = ?').get(leaveId) as Row | undefined
  return row ? toLeave(row) : null
}

export function deleteEmployeeLeave(leaveId: string, userId: string): boolean {
  const result = stmt('DELETE FROM employee_leaves WHERE id = ? AND user_id = ?').run(leaveId, userId)
  return Number(result.changes) > 0
}

/* ------------------------------- login security ------------------------------ */

export interface LoginLockoutRecord {
  accountKey: string
  failedCount: number
  lastFailedAt?: string
  lockedUntil?: string
  lastSuccessAt?: string
  lastIp?: string
}

export interface LoginEventRecord {
  id: string
  username: string
  userId?: string
  outcome: 'success' | 'failed' | 'locked'
  ip?: string
  at: string
}

export function getLoginLockout(accountKey: string): LoginLockoutRecord | null {
  const row = stmt('SELECT * FROM login_lockouts WHERE account_key = ?').get(accountKey) as Row | undefined
  if (!row) return null
  return {
    accountKey: String(row.account_key),
    failedCount: Number(row.failed_count ?? 0),
    lastFailedAt: row.last_failed_at ? String(row.last_failed_at) : undefined,
    lockedUntil: row.locked_until ? String(row.locked_until) : undefined,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : undefined,
    lastIp: row.last_ip ? String(row.last_ip) : undefined,
  }
}

export function recordLoginFailure(
  accountKey: string,
  username: string,
  userId: string | undefined,
  ip: string,
): { failedCount: number; lockedUntil?: string } {
  const now = new Date()
  const nowIso = now.toISOString()
  const current = getLoginLockout(accountKey)
  const prevCount = current && (!current.lockedUntil || new Date(current.lockedUntil).getTime() <= now.getTime())
    ? current.failedCount
    : 0
  const nextCount = prevCount + 1
  const lockedUntil = nextCount >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null

  stmt(
    `INSERT INTO login_lockouts (account_key, failed_count, last_failed_at, locked_until, last_ip)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_key) DO UPDATE SET
       failed_count = excluded.failed_count,
       last_failed_at = excluded.last_failed_at,
       locked_until = excluded.locked_until,
       last_ip = excluded.last_ip`,
  ).run(accountKey, nextCount, nowIso, lockedUntil, ip)

  stmt('INSERT INTO login_events (id, username, user_id, outcome, ip, at) VALUES (?, ?, ?, ?, ?, ?)').run(
    `le_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    username,
    userId ?? null,
    nextCount >= 5 ? 'locked' : 'failed',
    ip,
    nowIso,
  )

  return { failedCount: nextCount, lockedUntil: lockedUntil ?? undefined }
}

export function recordLoginSuccess(accountKey: string, username: string, userId: string, ip: string): void {
  const nowIso = new Date().toISOString()
  stmt(
    `INSERT INTO login_lockouts (account_key, failed_count, locked_until, last_success_at, last_ip)
     VALUES (?, 0, NULL, ?, ?)
     ON CONFLICT(account_key) DO UPDATE SET
       failed_count = 0,
       locked_until = NULL,
       last_success_at = excluded.last_success_at,
       last_ip = excluded.last_ip`,
  ).run(accountKey, nowIso, ip)

  stmt('INSERT INTO login_events (id, username, user_id, outcome, ip, at) VALUES (?, ?, ?, ?, ?, ?)').run(
    `le_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    username,
    userId,
    'success',
    ip,
    nowIso,
  )
}

export function getLoginSecuritySummary() {
  const nowIso = new Date().toISOString()
  const totalFailedRow = stmt("SELECT COUNT(*) AS count FROM login_events WHERE outcome IN ('failed', 'locked')").get() as Row
  const lockedRows = stmt('SELECT * FROM login_lockouts WHERE locked_until IS NOT NULL AND locked_until > ? ORDER BY locked_until DESC').all(nowIso) as Row[]
  const recentSuccessRows = stmt("SELECT * FROM login_events WHERE outcome = 'success' ORDER BY at DESC LIMIT 10").all() as Row[]
  const recentFailedRows = stmt("SELECT * FROM login_events WHERE outcome IN ('failed', 'locked') ORDER BY at DESC LIMIT 15").all() as Row[]
  const lockoutHistoryRows = stmt("SELECT * FROM login_events WHERE outcome = 'locked' ORDER BY at DESC LIMIT 10").all() as Row[]

  const toEvent = (r: Row): LoginEventRecord => ({
    id: String(r.id),
    username: String(r.username),
    userId: r.user_id ? String(r.user_id) : undefined,
    outcome: r.outcome as LoginEventRecord['outcome'],
    ip: r.ip ? String(r.ip) : undefined,
    at: String(r.at),
  })

  return {
    totalFailed: Number(totalFailedRow?.count ?? 0),
    lockedAccounts: lockedRows.map((r) => ({
      accountKey: String(r.account_key),
      failedCount: Number(r.failed_count ?? 0),
      lockedUntil: String(r.locked_until),
      lastIp: r.last_ip ? String(r.last_ip) : undefined,
    })),
    recentSuccess: recentSuccessRows.map(toEvent),
    recentFailed: recentFailedRows.map(toEvent),
    lockoutHistory: lockoutHistoryRows.map(toEvent),
  }
}

/* ---------------------------------- reset ---------------------------------- */

export function clearAllData(): void {
  db.exec('DELETE FROM pass_reminders; DELETE FROM scans; DELETE FROM walkins; DELETE FROM passes; DELETE FROM logs;')
}
