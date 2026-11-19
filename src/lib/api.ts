import type { AuditLog, Pass, Role, ScanEvent, ScanFeedback, WalkIn } from '@/types'

export const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
const TOKEN_KEY = 'parkpro.token.v1'

export interface ApiUser {
  id: string
  username: string
  role: Role
  name: string
}

export interface SitePayload {
  name: string
  capacity: number
}

export interface AuthResponse {
  token: string
  user: ApiUser
}

export interface BootstrapPayload {
  site: SitePayload
  passes: Pass[]
  scans: ScanEvent[]
  walkins: WalkIn[]
  logs: AuditLog[]
  at: string
}

export interface ScanResponse {
  outcome: ScanFeedback['outcome']
  direction: ScanFeedback['direction']
  at: string
  message?: string
  event: ScanEvent
  pass?: Pass
  daysLeft?: number
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let token: string | null = readStoredToken()

export function hasToken(): boolean {
  return Boolean(token)
}

export function setToken(value: string, remember: boolean): void {
  token = value
  try {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, value)
      sessionStorage.removeItem(TOKEN_KEY)
    } else {
      sessionStorage.setItem(TOKEN_KEY, value)
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    /* storage blocked — the in-memory token still works for this tab */
  }
}

export function clearToken(): void {
  token = null
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.')
  }

  if (response.status === 401 && token) {
    clearToken()
    window.dispatchEvent(new Event('parkpro:unauthorized'))
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(response.status, data?.error ?? `Request failed (${response.status})`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  health: () => request<{ ok: boolean; demoLogin: boolean; uptime: number }>('/health'),

  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  demoLogin: (role: Role) =>
    request<AuthResponse>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  me: () => request<{ user: ApiUser }>('/auth/me'),

  eventTicket: () => request<{ ticket: string; expiresIn: number }>('/events/ticket', { method: 'POST' }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  bootstrap: () => request<BootstrapPayload>('/bootstrap'),

  createPass: (pass: Pass) =>
    request<{ pass: Pass }>('/passes', { method: 'POST', body: JSON.stringify(pass) }),

  updatePass: (pass: Pass) =>
    request<{ pass: Pass }>(`/passes/${encodeURIComponent(pass.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(pass),
    }),

  deletePass: (id: string) => request<{ ok: true }>(`/passes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  scan: (text: string, source: 'camera' | 'manual') =>
    request<ScanResponse>('/scans/scan', { method: 'POST', body: JSON.stringify({ text, source }) }),

  createWalkIn: (walkIn: WalkIn) =>
    request<{ walkin: WalkIn }>('/walkins', { method: 'POST', body: JSON.stringify(walkIn) }),

  createLog: (log: AuditLog) => request<{ log: AuditLog }>('/logs', { method: 'POST', body: JSON.stringify(log) }),

  clearLogs: () => request<{ ok: true }>('/logs', { method: 'DELETE' }),

  updateSite: (patch: Partial<SitePayload>) =>
    request<{ site: SitePayload }>('/site', { method: 'PATCH', body: JSON.stringify(patch) }),

  sync: (payload: { scans: ScanEvent[]; walkins: WalkIn[] }) =>
    request<{ scans: number; walkins: number; at: string }>('/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetDemo: () => request<{ ok: true }>('/demo/reset', { method: 'POST' }),
}
