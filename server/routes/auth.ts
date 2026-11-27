import { Router, type Request } from 'express'
import { authenticate, hashPassword, issueToken, publicUser, requirePermission, verifyPassword } from '../auth'
import { env } from '../env'
import {
  findUserByUsername,
  getLoginLockout,
  getLoginSecuritySummary,
  recordEmployeeLogin,
  recordEmployeeLogout,
  recordLoginFailure,
  recordLoginSuccess,
  updateUserPassword,
} from '../repository'
import { asObject, fail, oneOf, str } from '../validate'

const router = Router()

const WINDOW_MS = 5 * 60_000
const MAX_ATTEMPTS = 12
const attempts = new Map<string, { count: number; resetAt: number }>()

function guard(req: Request): string {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.delete(key)
    return key
  }
  if (entry.count >= MAX_ATTEMPTS) fail(429, 'Too many attempts. Please wait a few minutes and try again.')
  return key
}

function recordFailure(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
}

router.post('/login', (req, res) => {
  const key = guard(req)
  const body = asObject(req.body)
  const username = str(body.username, 'Username', { max: 64 })
  const password = str(body.password, 'Password', { max: 128 })

  const accountKey = username.trim().toLowerCase()
  const existingLock = getLoginLockout(accountKey)
  if (existingLock?.lockedUntil) {
    const remainingMs = new Date(existingLock.lockedUntil).getTime() - Date.now()
    if (remainingMs > 0) {
      res.status(423).json({
        error: 'Your account has been temporarily locked due to multiple failed login attempts. Please try again after 15 minutes.',
        lockedUntil: existingLock.lockedUntil,
        remainingSeconds: Math.ceil(remainingMs / 1000),
      })
      return
    }
  }

  const user = findUserByUsername(username)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailure(key)
    const { failedCount, lockedUntil } = recordLoginFailure(accountKey, username.trim(), user?.id, key)
    if (failedCount >= 5 && lockedUntil) {
      res.status(423).json({
        error: 'Your account has been temporarily locked for 15 minutes.',
        lockedUntil,
        remainingSeconds: 15 * 60,
      })
      return
    }
    if (failedCount === 4) {
      fail(401, 'Warning: Only 1 login attempt remaining. Your account will be temporarily locked after another failed attempt.')
    }
    if (failedCount === 3) {
      fail(401, 'Warning: You have 2 login attempts remaining.')
    }
    fail(401, 'Invalid username or password.')
  }
  if (!user.active) fail(403, 'This staff account has been disabled. Contact the administrator.')
  attempts.delete(key)
  recordLoginSuccess(accountKey, user.username, user.id, key)
  recordEmployeeLogin(user.id)
  res.json({ token: issueToken(user), user: publicUser(user) })
})

router.get('/security', authenticate, requirePermission('employees', 'siteSettings'), (_req, res) => {
  res.json(getLoginSecuritySummary())
})

router.post('/demo', (req, res) => {
  if (!env.demoLogin) fail(404, 'Demo login is disabled')
  const body = asObject(req.body)
  const role = oneOf(body.role, 'role', ['owner', 'staff'] as const)
  const user = findUserByUsername(role === 'owner' ? 'admin' : 'staff')
  if (!user) fail(404, 'Demo account not found')
  if (!user.active) fail(403, 'This account is currently disabled')
  recordEmployeeLogin(user.id)
  res.json({ token: issueToken(user), user: publicUser(user) })
})

router.post('/logout', authenticate, (req, res) => {
  recordEmployeeLogout(req.user!.id)
  res.json({ ok: true })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

router.post('/password', authenticate, (req, res) => {
  const body = asObject(req.body)
  const current = str(body.currentPassword, 'Current password', { max: 128 })
  const next = str(body.newPassword, 'New password', { min: 8, max: 128 })

  const user = findUserByUsername(req.user!.username)
  if (!user || !verifyPassword(current, user.passwordHash)) {
    fail(400, 'Current password is incorrect')
  }
  updateUserPassword(user.id, hashPassword(next))
  res.json({ ok: true })
})

export default router
