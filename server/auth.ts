import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Role, StaffPermissionKey, StaffPermissions } from '../src/types'
import { hasPermission } from '../src/lib/permissions'
import { env } from './env'
import { findUserById, type UserRecord } from './repository'

export interface AuthUser {
  id: string
  username: string
  role: Role
  name: string
  permissions: StaffPermissions
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function issueToken(user: UserRecord): string {
  return jwt.sign({ role: user.role, username: user.username, name: user.name }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.tokenTtl,
  })
}

export function publicUser(user: UserRecord): AuthUser {
  return { id: user.id, username: user.username, role: user.role, name: user.name, permissions: user.permissions }
}

export const authenticate: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    if (typeof payload === 'string' || !payload.sub) throw new Error('invalid token')
    const user = findUserById(String(payload.sub))
    if (!user || !user.active) throw new Error('unknown user')
    req.user = publicUser(user)
    next()
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' })
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission for this action' })
      return
    }
    next()
  }
}

export function requirePermission(...anyOf: StaffPermissionKey[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !anyOf.some((perm) => hasPermission(req.user!.role, req.user!.permissions, perm))) {
      res.status(403).json({ error: 'You do not have permission for this action' })
      return
    }
    next()
  }
}
