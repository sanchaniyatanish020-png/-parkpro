import type { AppSettings, Lang, ThemeMode } from '@/types'

export const SETTINGS_KEY = 'parkpro.settings.v1'
export const AUTH_KEY = 'parkpro.auth.v1'
export const SESSION_KEY = 'parkpro.session.v1'

export const PIN_STAFF = '1234'
export const PIN_OWNER = '4321'

export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'admin123'
export const DEFAULT_STAFF_USERNAME = 'staff'
export const DEFAULT_STAFF_PASSWORD = 'staff123'
export const DEFAULT_OWNER_NAME = 'Bhavesh Porva'

export const defaultSettings: AppSettings = {
  role: 'staff',
  lang: 'en',
  theme: 'light',
  sound: true,
  haptics: true,
  autoLockMin: 10,
  adminUsername: DEFAULT_ADMIN_USERNAME,
  adminPassword: DEFAULT_ADMIN_PASSWORD,
  staffUsername: DEFAULT_STAFF_USERNAME,
  staffPassword: DEFAULT_STAFF_PASSWORD,
  pin: PIN_STAFF,
  ownerPin: PIN_OWNER,
  rememberDevice: true,
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
  whatsappConfigured: false,
  notifications: { expiring: true, nearlyFull: true, overstay: true },
  staffName: 'Arjun Rathod',
  ownerName: DEFAULT_OWNER_NAME,
  siteName: 'Riverfront Parking',
  fontScale: 1,
  simulateOffline: false,
}

export function loadSettings(): AppSettings {
  if (typeof localStorage === 'undefined') return defaultSettings
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...defaultSettings,
      ...parsed,
      theme: parsed.theme && parsed.theme !== 'system' ? parsed.theme : 'light',
      ownerName: parsed.ownerName || DEFAULT_OWNER_NAME,
      notifications: { ...defaultSettings.notifications, ...parsed.notifications },
    }
  } catch {
    return defaultSettings
  }
}

export function persistSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* storage full or blocked — preferences fall back to defaults */
  }
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(mode: ThemeMode) {
  const dark = resolveDark(mode)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
  if (meta) meta.setAttribute('content', dark ? '#071527' : '#0B1F3A')
}

export function applyLanguage(lang: Lang) {
  document.documentElement.lang = lang
}

export function applyFontScale(scale: number) {
  document.documentElement.style.setProperty('--font-scale', String(scale))
}

export function passwordForRole(role: AppSettings['role'], settings: AppSettings): string {
  return role === 'owner'
    ? settings.adminPassword || DEFAULT_ADMIN_PASSWORD
    : settings.staffPassword || DEFAULT_STAFF_PASSWORD
}
