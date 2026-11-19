export type Role = 'staff' | 'owner'
export type Lang = 'en' | 'hi' | 'gu'
export type ThemeMode = 'system' | 'light' | 'dark'

export type VehicleType = 'car' | 'suv' | 'bike' | 'ev'
export type PlanId = 'daily' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly'
export type PassStatus = 'active' | 'expiring' | 'expired'

export type Direction = 'IN' | 'OUT' | 'DENIED'
export type ScanOutcome = 'success' | 'expiring' | 'expired' | 'unknown'
export type PaymentMode = 'cash' | 'upi' | 'card'

export interface Pass {
  id: string
  token: string
  name: string
  phone: string
  vehicle: string
  vehicleType: VehicleType
  plan: PlanId
  startDate: string
  endDate: string
  amount: number
  slot?: string
  photo?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ScanEvent {
  id: string
  passId?: string
  token?: string
  name?: string
  phone?: string
  vehicle?: string
  photo?: string
  direction: Direction
  outcome: ScanOutcome
  at: string
  source: 'camera' | 'manual'
  synced: boolean
}

export interface WalkIn {
  id: string
  name: string
  phone: string
  vehicle?: string
  vehicleType: VehicleType
  photo?: string
  amount: number
  at: string
  synced: boolean
}

export type LogKind = 'scan' | 'walkin' | 'pass' | 'sync' | 'auth' | 'system'

export interface AuditLog {
  id: string
  kind: LogKind
  message: string
  at: string
  level: 'info' | 'success' | 'warn' | 'error'
  meta?: Record<string, string | number | boolean | undefined>
}

export interface AppSettings {
  role: Role
  lang: Lang
  theme: ThemeMode
  sound: boolean
  haptics: boolean
  autoLockMin: number
  adminUsername: string
  adminPassword: string
  staffUsername: string
  staffPassword: string
  pin?: string
  ownerPin?: string
  rememberDevice: boolean
  capacity: number
  notifications: {
    expiring: boolean
    nearlyFull: boolean
    overstay: boolean
  }
  staffName: string
  ownerName: string
  siteName: string
  fontScale: number
  simulateOffline: boolean
}

export interface Session {
  role: Role
  unlocked: boolean
  method: 'password' | 'pin' | 'biometric' | 'demo'
  at: number
}

export type ScanInput = {
  text: string
  source: 'camera' | 'manual'
}

export interface ScanFeedback {
  outcome: ScanOutcome
  direction: Direction
  pass?: Pass
  daysLeft?: number
  at: string
  message?: string
  eventId?: string
}

export type PayMode = PaymentMode

export interface NewPassInput {
  name: string
  phone: string
  vehicle: string
  vehicleType: VehicleType
  plan: PlanId
  startDate: string
  endDate: string
  amount: number
  slot?: string
  notes?: string
  photo?: string
}

export interface NewWalkInInput {
  name: string
  phone: string
  vehicle?: string
  vehicleType: VehicleType
  photo?: string
  amount: number
}

export interface ParkedItem {
  pass: Pass
  since: string
}

export interface SiteStats {
  activePasses: number
  expiring: number
  expired: number
  parked: number
  walkinsToday: number
  capacity: number
  occupied: number
  occupancyPct: number
  todayRevenue: number
  todayEntries: number
  pending: number
  totalPasses: number
  totalRevenue: number
}
