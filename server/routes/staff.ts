import { Router } from 'express'
import { resolvePermissions } from '../../src/lib/permissions'
import { uid } from '../../src/lib/utils'
import { authenticate, hashPassword, requirePermission } from '../auth'
import { appendLog } from '../log'
import {
  deleteEmployeeLeave,
  findUserById,
  findUserByUsername,
  insertUser,
  listAllEmployeeLeaves,
  listAllEmployeeSessions,
  listEmployeeLeaves,
  listEmployeeSessions,
  listStaffUsers,
  setUserActive,
  updateEmployeeLeaveStatus,
  updateEmployeeSessionLogout,
  updateUserHourlyRate,
  updateUserMonthlySalary,
  updateUserPermissions,
  upsertEmployeeLeave,
  type EmployeeLeaveRecord,
  type EmployeeSessionRecord,
  type UserRecord,
} from '../repository'
import { asObject, fail, isoDate, num, str } from '../validate'

const router = Router()
router.use(authenticate)

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function resolveMonth(raw: unknown): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw.trim())) {
    const [y, m] = raw.trim().split('-').map(Number)
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) return raw.trim()
  }
  return currentMonthKey()
}

function monthRange(month: string): { startMs: number; endMs: number; daysInMonth: number } {
  const [y, m] = month.split('-').map(Number)
  return {
    startMs: new Date(y, m - 1, 1).getTime(),
    endMs: new Date(y, m, 1).getTime(),
    daysInMonth: new Date(y, m, 0).getDate(),
  }
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function summarizeMonth(
  user: UserRecord,
  allSessions: EmployeeSessionRecord[],
  allLeaves: EmployeeLeaveRecord[],
  month: string,
) {
  const { startMs, endMs, daysInMonth } = monthRange(month)
  const nowMs = Date.now()
  const monthSessions = allSessions
    .filter((s) => {
      const t = new Date(s.loginAt).getTime()
      return t >= startMs && t < endMs
    })
    .map((s) => {
      const start = new Date(s.loginAt).getTime()
      const end = s.logoutAt ? new Date(s.logoutAt).getTime() : Math.min(nowMs, endMs)
      const durationMinutes = Math.max(0, Math.round((end - start) / 60_000))
      return {
        ...s,
        durationMinutes,
        status: s.logoutAt ? ('completed' as const) : ('active' as const),
      }
    })

  const monthLeaves = allLeaves.filter((l) => l.leaveDate.startsWith(month))
  const totalMinutes = monthSessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100
  const totalLeaves = monthLeaves
    .filter((l) => l.status === 'approved')
    .reduce((sum, l) => sum + (l.leaveType === 'half' ? 0.5 : 1), 0)
  const pendingLeaves = monthLeaves.filter((l) => l.status === 'pending').length
  const baseSalary = user.monthlySalary ?? 0
  const leaveDeduction = baseSalary > 0 ? Math.round((baseSalary / daysInMonth) * totalLeaves) : 0
  const calculatedSalary = Math.max(0, Math.round(baseSalary - leaveDeduction))
  const daysWorked = new Set(monthSessions.map((s) => toLocalDateKey(s.loginAt))).size
  const isOnline = allSessions.some((s) => !s.logoutAt)
  const lastLoginAt = allSessions[0]?.loginAt
  const lastLogoutAt = allSessions.find((s) => s.logoutAt)?.logoutAt

  return {
    monthSessions,
    monthLeaves,
    summary: {
      totalMinutes,
      totalHours,
      calculatedSalary,
      leaveDeduction,
      totalLeaves,
      pendingLeaves,
      daysWorked,
      daysInMonth,
      sessionsCount: monthSessions.length,
      isOnline,
      lastLoginAt,
      lastLogoutAt,
    },
  }
}

function publicStaff(
  user: UserRecord,
  monthSummary?: ReturnType<typeof summarizeMonth>['summary'],
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: 'staff' as const,
    active: user.active,
    permissions: user.permissions,
    hourlyRate: user.hourlyRate ?? 0,
    monthlySalary: user.monthlySalary ?? 0,
    createdAt: user.createdAt,
    ...(monthSummary ? { monthSummary } : {}),
  }
}

/* --------------------- staff self-service leave requests ------------------- */

router.get('/my-leaves', (req, res) => {
  res.json({ leaves: listEmployeeLeaves(req.user!.id) })
})

router.post('/my-leaves', (req, res) => {
  const body = asObject(req.body)
  const leaveDate = str(body.leaveDate, 'Leave date', { min: 10, max: 10 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) {
    fail(400, 'Leave date must be YYYY-MM-DD')
  }
  const existing = listEmployeeLeaves(req.user!.id).find((l) => l.leaveDate === leaveDate)
  if (existing?.status === 'approved') {
    fail(409, 'Leave for this date is already approved')
  }
  const leaveType = body.leaveType === 'half' ? 'half' : 'full'
  const reason = body.reason ? str(body.reason, 'Reason', { min: 1, max: 200 }) : undefined

  const leave = upsertEmployeeLeave({
    id: uid('lv_'),
    userId: req.user!.id,
    leaveDate,
    leaveType,
    status: 'pending',
    reason,
    createdBy: req.user!.name,
    createdAt: new Date().toISOString(),
  })
  appendLog('system', `Leave request (${leaveDate}) submitted by ${req.user!.name}`, 'info')
  res.status(201).json({ leave })
})

router.delete('/my-leaves/:leaveId', (req, res) => {
  const existing = listEmployeeLeaves(req.user!.id).find((l) => l.id === String(req.params.leaveId))
  if (!existing) fail(404, 'Leave request not found')
  if (existing.status === 'approved') fail(400, 'Approved leave cannot be cancelled here')
  deleteEmployeeLeave(existing.id, req.user!.id)
  res.json({ ok: true })
})

router.get('/', requirePermission('employees', 'siteSettings'), (req, res) => {
  const month = resolveMonth(req.query.month)
  const staffList = listStaffUsers()
  const allSessions = listAllEmployeeSessions()
  const allLeaves = listAllEmployeeLeaves()

  const sessionsByUser = new Map<string, EmployeeSessionRecord[]>()
  for (const s of allSessions) {
    const arr = sessionsByUser.get(s.userId) ?? []
    arr.push(s)
    sessionsByUser.set(s.userId, arr)
  }

  const leavesByUser = new Map<string, EmployeeLeaveRecord[]>()
  for (const l of allLeaves) {
    const arr = leavesByUser.get(l.userId) ?? []
    arr.push(l)
    leavesByUser.set(l.userId, arr)
  }

  const userById = new Map(staffList.map((u) => [u.id, u]))
  const pendingRequests = allLeaves
    .filter((l) => l.status === 'pending')
    .map((l) => {
      const emp = userById.get(l.userId)
      return {
        ...l,
        employeeName: emp?.name ?? l.createdBy ?? 'Staff',
        employeeUsername: emp?.username ?? '',
      }
    })

  res.json({
    month,
    pendingRequests,
    staff: staffList.map((user) => {
      const { summary } = summarizeMonth(
        user,
        sessionsByUser.get(user.id) ?? [],
        leavesByUser.get(user.id) ?? [],
        month,
      )
      return publicStaff(user, summary)
    }),
  })
})

router.get('/:id/details', requirePermission('employees'), (req, res) => {
  const target = findUserById(String(req.params.id))
  if (!target || target.role !== 'staff') {
    fail(404, 'Employee not found')
  }
  const month = resolveMonth(req.query.month)
  const sessions = listEmployeeSessions(target.id)
  const leaves = listEmployeeLeaves(target.id)
  const { monthSessions, monthLeaves, summary } = summarizeMonth(target, sessions, leaves, month)

  res.json({
    month,
    employee: publicStaff(target, summary),
    sessions: monthSessions,
    leaves: monthLeaves,
    summary,
  })
})

router.post('/', requirePermission('employees', 'siteSettings'), (req, res) => {
  const body = asObject(req.body)
  const name = str(body.name, 'Full name', { min: 2, max: 60 })
  const username = str(body.username, 'Username', { min: 3, max: 32 }).toLowerCase()
  if (!/^[a-z0-9._-]+$/.test(username)) {
    fail(400, 'Username can only contain letters, numbers, dots, underscores, or hyphens')
  }
  const password = str(body.password, 'Password', { min: 8, max: 128 })
  const hourlyRate = body.hourlyRate !== undefined ? num(body.hourlyRate, 'Hourly rate', { min: 0, max: 50000 }) : 0
  const monthlySalary =
    body.monthlySalary !== undefined ? num(body.monthlySalary, 'Monthly salary', { min: 0, max: 10_000_000 }) : 0
  const permissions = resolvePermissions('staff', body.permissions)

  if (findUserByUsername(username)) {
    fail(409, 'This username is already in use')
  }

  const user: UserRecord = {
    id: uid('u_'),
    username,
    passwordHash: hashPassword(password),
    role: 'staff',
    name,
    active: true,
    permissions,
    hourlyRate,
    monthlySalary,
    createdAt: new Date().toISOString(),
  }
  insertUser(user)
  appendLog('system', `Added staff member ${name} (@${username}) by ${req.user!.name}`, 'info')
  res.status(201).json({ staff: publicStaff(user) })
})

router.patch('/:id', requirePermission('employees', 'siteSettings'), (req, res) => {
  const target = findUserById(String(req.params.id))
  if (!target || target.role !== 'staff') {
    fail(404, 'Staff member not found')
  }
  const body = asObject(req.body)
  const hasActive = body.active !== undefined
  const hasPermissions = body.permissions !== undefined
  const hasHourlyRate = body.hourlyRate !== undefined
  const hasMonthlySalary = body.monthlySalary !== undefined
  if (!hasActive && !hasPermissions && !hasHourlyRate && !hasMonthlySalary) {
    fail(400, 'No changes provided')
  }
  if ((hasActive || hasPermissions) && target.id === req.user!.id) {
    fail(400, 'You cannot modify your own access')
  }

  let updated: UserRecord = target
  if (hasActive) {
    if (typeof body.active !== 'boolean') {
      fail(400, 'active must be true or false')
    }
    const next = setUserActive(target.id, body.active)
    if (!next) fail(404, 'Staff member not found')
    updated = next
    appendLog(
      'system',
      `${updated.active ? 'Enabled' : 'Disabled'} staff member ${updated.name} (@${updated.username}) by ${req.user!.name}`,
      updated.active ? 'info' : 'warn',
    )
  }

  if (hasPermissions) {
    if (!body.permissions || typeof body.permissions !== 'object' || Array.isArray(body.permissions)) {
      fail(400, 'permissions must be an object')
    }
    const nextPerms = resolvePermissions('staff', body.permissions)
    const next = updateUserPermissions(target.id, nextPerms)
    if (!next) fail(404, 'Staff member not found')
    updated = next
    appendLog(
      'system',
      `Updated rights for ${updated.name} (@${updated.username}) by ${req.user!.name}`,
      'info',
    )
  }

  if (hasHourlyRate) {
    const rate = num(body.hourlyRate, 'Hourly rate', { min: 0, max: 50000 })
    const next = updateUserHourlyRate(target.id, rate)
    if (!next) fail(404, 'Staff member not found')
    updated = next
  }

  if (hasMonthlySalary) {
    const salary = num(body.monthlySalary, 'Monthly salary', { min: 0, max: 10_000_000 })
    const next = updateUserMonthlySalary(target.id, salary)
    if (!next) fail(404, 'Staff member not found')
    updated = next
  }

  res.json({ staff: publicStaff(updated) })
})

router.post('/:id/leaves', requirePermission('employees'), (req, res) => {
  const target = findUserById(String(req.params.id))
  if (!target || target.role !== 'staff') {
    fail(404, 'Employee not found')
  }
  const body = asObject(req.body)
  const leaveDate = str(body.leaveDate, 'Leave date', { min: 10, max: 10 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) {
    fail(400, 'Leave date must be YYYY-MM-DD')
  }
  const leaveType = body.leaveType === 'half' ? 'half' : 'full'
  const reason = body.reason ? str(body.reason, 'Reason', { min: 1, max: 200 }) : undefined

  const leave = upsertEmployeeLeave({
    id: uid('lv_'),
    userId: target.id,
    leaveDate,
    leaveType,
    status: 'approved',
    reason,
    createdBy: req.user!.name,
    reviewedBy: req.user!.name,
    reviewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  })
  res.status(201).json({ leave })
})

router.patch('/:id/leaves/:leaveId', requirePermission('employees'), (req, res) => {
  const target = findUserById(String(req.params.id))
  if (!target || target.role !== 'staff') {
    fail(404, 'Employee not found')
  }
  const body = asObject(req.body)
  if (body.status !== 'approved' && body.status !== 'rejected') {
    fail(400, 'status must be approved or rejected')
  }
  const updated = updateEmployeeLeaveStatus(String(req.params.leaveId), target.id, body.status, req.user!.name)
  if (!updated) fail(404, 'Leave record not found')
  appendLog(
    'system',
    `${body.status === 'approved' ? 'Approved' : 'Rejected'} leave (${updated.leaveDate}) for ${target.name} by ${req.user!.name}`,
    body.status === 'approved' ? 'info' : 'warn',
  )
  res.json({ leave: updated })
})

router.delete('/:id/leaves/:leaveId', requirePermission('employees'), (req, res) => {
  const target = findUserById(String(req.params.id))
  if (!target || target.role !== 'staff') {
    fail(404, 'Employee not found')
  }
  if (!deleteEmployeeLeave(String(req.params.leaveId), target.id)) {
    fail(404, 'Leave record not found')
  }
  res.json({ ok: true })
})

router.patch('/:id/sessions/:sessionId', requirePermission('employees'), (req, res) => {
  const target = findUserById(String(req.params.id))
  if (!target || target.role !== 'staff') {
    fail(404, 'Employee not found')
  }
  const body = asObject(req.body)
  const logoutAt = isoDate(body.logoutAt, 'Logout time')
  const updated = updateEmployeeSessionLogout(String(req.params.sessionId), target.id, logoutAt)
  if (!updated) fail(404, 'Session not found')
  res.json({ session: updated })
})

export default router
