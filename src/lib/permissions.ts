import type { Role, StaffPermissionKey, StaffPermissions } from '../types'

export const STAFF_PERMISSION_KEYS: readonly StaffPermissionKey[] = [
  'scan',
  'parked',
  'walkin',
  'history',
  'dashboard',
  'revenue',
  'passes',
  'managePasses',
  'reports',
  'employees',
  'siteSettings',
]

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  scan: true,
  parked: true,
  walkin: true,
  history: true,
  dashboard: false,
  revenue: false,
  passes: false,
  managePasses: false,
  reports: false,
  employees: false,
  siteSettings: false,
}

export const ALL_PERMISSIONS: StaffPermissions = {
  scan: true,
  parked: true,
  walkin: true,
  history: true,
  dashboard: true,
  revenue: true,
  passes: true,
  managePasses: true,
  reports: true,
  employees: true,
  siteSettings: true,
}

export interface PermissionItemMeta {
  key: StaffPermissionKey
  group: 'gate' | 'admin'
  labelKey: string
  descKey: string
}

export const PERMISSION_ITEMS: readonly PermissionItemMeta[] = [
  { key: 'scan', group: 'gate', labelKey: 'rights.scan', descKey: 'rights.scanDesc' },
  { key: 'parked', group: 'gate', labelKey: 'rights.parked', descKey: 'rights.parkedDesc' },
  { key: 'walkin', group: 'gate', labelKey: 'rights.walkin', descKey: 'rights.walkinDesc' },
  { key: 'history', group: 'gate', labelKey: 'rights.history', descKey: 'rights.historyDesc' },
  { key: 'dashboard', group: 'admin', labelKey: 'rights.dashboard', descKey: 'rights.dashboardDesc' },
  { key: 'revenue', group: 'admin', labelKey: 'rights.revenue', descKey: 'rights.revenueDesc' },
  { key: 'passes', group: 'admin', labelKey: 'rights.passes', descKey: 'rights.passesDesc' },
  { key: 'managePasses', group: 'admin', labelKey: 'rights.managePasses', descKey: 'rights.managePassesDesc' },
  { key: 'reports', group: 'admin', labelKey: 'rights.reports', descKey: 'rights.reportsDesc' },
  { key: 'employees', group: 'admin', labelKey: 'rights.employees', descKey: 'rights.employeesDesc' },
  { key: 'siteSettings', group: 'admin', labelKey: 'rights.siteSettings', descKey: 'rights.siteSettingsDesc' },
]

export function normalizeStaffPermissions(perms: StaffPermissions): StaffPermissions {
  return perms.managePasses && !perms.passes ? { ...perms, passes: true } : perms
}

export function toggleStaffPermission(
  current: StaffPermissions,
  key: StaffPermissionKey,
  value: boolean,
): StaffPermissions {
  const next: StaffPermissions = { ...current, [key]: value }
  if (key === 'managePasses' && value) next.passes = true
  if (key === 'passes' && !value) next.managePasses = false
  return next
}

export function resolvePermissions(role: Role, raw?: unknown): StaffPermissions {
  if (role === 'owner') return { ...ALL_PERMISSIONS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_STAFF_PERMISSIONS }
  }
  const source = raw as Record<string, unknown>
  const out = { ...DEFAULT_STAFF_PERMISSIONS }
  for (const key of STAFF_PERMISSION_KEYS) {
    if (typeof source[key] === 'boolean') {
      out[key] = source[key]
    }
  }
  return normalizeStaffPermissions(out)
}

export function hasPermission(
  role: Role,
  permissions: StaffPermissions | undefined,
  perm: StaffPermissionKey,
): boolean {
  if (role === 'owner') return true
  return Boolean((permissions ?? DEFAULT_STAFF_PERMISSIONS)[perm])
}

export function countGrantedPermissions(permissions: StaffPermissions): number {
  return STAFF_PERMISSION_KEYS.reduce((count, key) => count + (permissions[key] ? 1 : 0), 0)
}

export function defaultHomeRoute(role: Role, permissions: StaffPermissions | undefined): string {
  if (role === 'owner') return '/admin'
  const resolved = permissions ?? DEFAULT_STAFF_PERMISSIONS
  const order: [StaffPermissionKey, string][] = [
    ['parked', '/parked'],
    ['scan', '/scan'],
    ['walkin', '/walk-in'],
    ['history', '/history'],
    ['dashboard', '/admin'],
    ['revenue', '/admin'],
    ['passes', '/admin/passes'],
    ['reports', '/admin/reports'],
    ['employees', '/admin/employees'],
  ]
  for (const [key, path] of order) {
    if (resolved[key]) return path
  }
  return '/settings'
}
