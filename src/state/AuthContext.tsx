import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Role, Session, StaffPermissionKey, StaffPermissions } from '@/types'
import { AUTH_KEY, SESSION_KEY, passwordForRole } from '@/lib/settings'
import { hasPermission, resolvePermissions } from '@/lib/permissions'
import { useSettings } from '@/state/SettingsContext'
import { uid } from '@/lib/utils'
import { api, ApiError, clearToken, hasToken, setToken, type ApiUser, type AuthResponse } from '@/lib/api'

interface StoredAuth {
  role: Role
  username: string
  name?: string
  method: Session['method']
  permissions?: StaffPermissions
  at: number
  exp?: number
  lastActive: number
}

interface AuthContextValue {
  authenticated: boolean
  locked: boolean
  role: Role
  username: string
  name: string
  permissions: StaffPermissions
  can: (perm: StaffPermissionKey) => boolean
  method: Session['method'] | null
  signIn: (username: string, password: string, remember: boolean) => Promise<void>
  signInDemo: (role: Role, remember: boolean) => Promise<void>
  signOut: () => void
  lock: () => void
  unlock: (password: string) => boolean
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  touch: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (parsed.exp && Date.now() > parsed.exp) {
      localStorage.removeItem(AUTH_KEY)
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStored(record: StoredAuth, remember: boolean): void {
  try {
    if (remember) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...record, exp: Date.now() + 7 * 86_400_000 }))
      sessionStorage.removeItem(SESSION_KEY)
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(record))
      localStorage.removeItem(AUTH_KEY)
    }
  } catch {
    /* storage blocked — the session still lives in memory */
  }
}

function clearStored(): void {
  localStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings()
  const initial = useRef<StoredAuth | null>(readStored()).current

  const [session, setSession] = useState<StoredAuth | null>(() => (initial && hasToken() ? initial : null))
  const [locked, setLocked] = useState(() => {
    if (!initial || !hasToken() || settings.autoLockMin === 0) return false
    return Date.now() - initial.lastActive > settings.autoLockMin * 60_000
  })

  const lastActive = useRef(session?.lastActive ?? Date.now())
  const lastWrite = useRef(0)

  const role = session?.role ?? settings.role
  const username = session?.username ?? ''
  const name = session?.name ?? ''
  const permissions = useMemo(
    () => resolvePermissions(role, session?.permissions),
    [role, session?.permissions],
  )
  const can = useCallback(
    (perm: StaffPermissionKey) => hasPermission(role, permissions, perm),
    [role, permissions],
  )

  const signOut = useCallback(() => {
    if (hasToken()) {
      void api.logout().catch(() => undefined)
      void api
        .createLog({
          id: uid('log_'),
          kind: 'auth',
          message: 'Signed out',
          at: new Date().toISOString(),
          level: 'info',
        })
        .catch(() => undefined)
    }
    clearToken()
    clearStored()
    setSession(null)
    setLocked(false)
  }, [])

  const completeSignIn = useCallback(
    (result: AuthResponse, method: Session['method'], keepSignedIn: boolean) => {
      setToken(result.token, keepSignedIn)
      const at = Date.now()
      lastActive.current = at
      const record: StoredAuth = {
        role: result.user.role,
        username: result.user.username,
        name: result.user.name,
        method,
        permissions: resolvePermissions(result.user.role, result.user.permissions),
        at,
        lastActive: at,
      }
      setSession(record)
      setLocked(false)
      writeStored(record, keepSignedIn)
      update({ role: result.user.role, rememberDevice: keepSignedIn })
      void api
        .createLog({
          id: uid('log_'),
          kind: 'auth',
          message: `${result.user.role === 'owner' ? 'Admin' : 'Gate staff'} (${result.user.username}) signed in via ${method}`,
          at: new Date().toISOString(),
          level: 'success',
        })
        .catch(() => undefined)
    },
    [update],
  )

  const signIn = useCallback(
    async (usernameInput: string, password: string, keepSignedIn: boolean) => {
      const result = await api.login(usernameInput.trim(), password)
      completeSignIn(result, 'password', keepSignedIn)
    },
    [completeSignIn],
  )

  const signInDemo = useCallback(
    async (nextRole: Role, keepSignedIn: boolean) => {
      const result = await api.demoLogin(nextRole)
      completeSignIn(result, 'demo', keepSignedIn)
    },
    [completeSignIn],
  )

  const authed = Boolean(session)

  useEffect(() => {
    if (!authed) return
    let active = true
    const applyUser = (user: ApiUser) => {
      const nextPerms = resolvePermissions(user.role, user.permissions)
      setSession((prev) => {
        if (!prev) return prev
        const next = { ...prev, role: user.role, username: user.username, name: user.name, permissions: nextPerms }
        writeStored(next, localStorage.getItem(AUTH_KEY) !== null)
        return next
      })
    }

    api
      .me()
      .then(({ user }) => {
        if (active) applyUser(user)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) signOut()
        // status 0 means the server is unreachable — keep the cached session for offline use.
      })

    const onUserEvent = (event: Event) => {
      const detail = (event as CustomEvent<ApiUser>).detail
      if (detail) applyUser(detail)
    }
    window.addEventListener('parkpro:user', onUserEvent)
    return () => {
      active = false
      window.removeEventListener('parkpro:user', onUserEvent)
    }
    // Re-run only when a session starts or ends, so live permission updates do not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  useEffect(() => {
    const onUnauthorized = () => {
      clearStored()
      setSession(null)
      setLocked(false)
    }
    window.addEventListener('parkpro:unauthorized', onUnauthorized)
    return () => window.removeEventListener('parkpro:unauthorized', onUnauthorized)
  }, [])

  const touch = useCallback(() => {
    const now = Date.now()
    lastActive.current = now
    if (now - lastWrite.current > 30_000) {
      lastWrite.current = now
      setSession((prev) => {
        if (!prev) return prev
        const record = { ...prev, lastActive: now }
        writeStored(record, localStorage.getItem(AUTH_KEY) !== null)
        return record
      })
    }
  }, [])

  const lock = useCallback(() => {
    if (!session) return
    setLocked(true)
    void api
      .createLog({
        id: uid('log_'),
        kind: 'auth',
        message: 'Screen locked after inactivity',
        at: new Date().toISOString(),
        level: 'warn',
      })
      .catch(() => undefined)
  }, [session])

  const unlock = useCallback(
    (password: string) => {
      const expected = passwordForRole(role, settings)
      if (password !== expected) return false
      setLocked(false)
      lastActive.current = Date.now()
      return true
    },
    [role, settings],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api.changePassword(currentPassword, newPassword)
      // Keep the device lock screen in step with the account password.
      update(role === 'owner' ? { adminPassword: newPassword } : { staffPassword: newPassword })
    },
    [role, update],
  )

  useEffect(() => {
    if (!session) return
    const check = () => {
      if (locked) return
      const minutes = settings.autoLockMin
      if (minutes > 0 && Date.now() - lastActive.current > minutes * 60_000) {
        if (document.visibilityState === 'visible') lock()
        else setLocked(true)
      }
    }
    const interval = window.setInterval(check, 20_000)
    const onActivity = () => {
      if (!locked) touch()
    }
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      document.removeEventListener('visibilitychange', check)
    }
  }, [session, locked, settings.autoLockMin, lock, touch])

  const value = useMemo<AuthContextValue>(
    () => ({
      authenticated: Boolean(session),
      locked: Boolean(session) && locked,
      role,
      username,
      name,
      permissions,
      can,
      method: session?.method ?? null,
      signIn,
      signInDemo,
      signOut,
      lock,
      unlock,
      changePassword,
      touch,
    }),
    [session, locked, role, username, name, permissions, can, signIn, signInDemo, signOut, lock, unlock, changePassword, touch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
