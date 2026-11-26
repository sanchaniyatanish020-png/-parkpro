import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Lang, Pass, PassStatus, PlanId, VehicleType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  return `${prefix}${rand}`
}

export const DAY = 86_400_000

export function startOfDay(d: Date | string): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date
}

export function endOfDay(d: Date | string): Date {
  const date = new Date(d)
  date.setHours(23, 59, 59, 999)
  return date
}

export function addDays(d: Date | string, days: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + days)
  return date
}

export function addMonths(d: Date | string, months: number): Date {
  const date = new Date(d)
  date.setMonth(date.getMonth() + months)
  return date
}

export function daysLeft(endDate: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((endOfDay(endDate).getTime() - now.getTime()) / DAY))
}

export function passStatus(pass: Pick<Pass, 'endDate'>, now: Date = new Date()): PassStatus {
  if (endOfDay(pass.endDate).getTime() < now.getTime()) return 'expired'
  return daysLeft(pass.endDate, now) <= 3 ? 'expiring' : 'active'
}

export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const LOCALES: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' }

export function formatMoney(amount: number, lang: Lang = 'en'): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(value: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

export function formatDateShort(value: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: 'short' }).format(new Date(value))
}

export function formatTime(value: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { hour: '2-digit', minute: '2-digit', hour12: true }).format(
    new Date(value),
  )
}

export function formatDateTime(value: string | Date, lang: Lang = 'en'): string {
  return `${formatDateShort(value, lang)}, ${formatTime(value, lang)}`
}

export function timeAgo(value: string | Date, lang: Lang = 'en', now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(value).getTime())
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return lang === 'hi' ? 'अभी' : lang === 'gu' ? 'હમણાં જ' : 'Just now'
  if (mins < 60) return lang === 'hi' ? `${mins} मि पहले` : lang === 'gu' ? `${mins} મિ પહેલાં` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return lang === 'hi' ? `${hrs} घं पहले` : lang === 'gu' ? `${hrs} કલાક પહેલાં` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return lang === 'hi' ? 'कल' : lang === 'gu' ? 'ગઈકાલે' : 'Yesterday'
  return formatDateShort(value, lang)
}

export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatPlate(value: string): string {
  const raw = normalizePlate(value)
  const match = raw.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{0,4})$/)
  if (!match) return raw
  return `${match[1]}${match[2]}${match[3]}${match[4]}`
}

export function validPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.replace(/\D/g, ''))
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const AVATAR_TONES = [
  'bg-[#E8F0FE] text-[#1A4C8B]',
  'bg-[#FFF1C6] text-[#8F5F00]',
  'bg-[#E7F6EC] text-[#166534]',
  'bg-[#FDE7E7] text-[#991B1B]',
  'bg-[#EDE9FE] text-[#5B21B6]',
  'bg-[#E0F2FE] text-[#075985]',
]

export function avatarTone(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export function purposeLabel(type: VehicleType, t: (key: string) => string): string {
  return t(`vehicle_${type}`)
}

export function planLabel(plan: PlanId, t: (key: string) => string): string {
  return t(`plan_${plan}`)
}

export const PLANS: PlanId[] = ['monthly']

export const PLAN_MONTHS: Record<PlanId, number> = {
  daily: 0,
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
}

/** Full monthly price (used as the base for pro-rating). */
export const MONTHLY_RATE = 1800

export const PLAN_PRICE: Record<PlanId, number> = {
  daily: 120,
  monthly: MONTHLY_RATE,
  quarterly: 4800,
  half_yearly: 8500,
  yearly: 15000,
}

/**
 * Calculate the end-of-month expiry date.
 * Returns the last day of the start date's month at 23:59:59.999,
 * so as soon as the 1st day of the next month starts (00:00), the pass is expired.
 */
export function monthEndDate(start: string | Date): Date {
  const d = new Date(start)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Pro-rate the monthly price based on how many days remain in the month.
 * E.g. if the month has 30 days and the pass starts on day 26,
 * remaining = 5 days → price = round(1800 * 5 / 30) = 300.
 * If the pass starts on day 1, full price is charged.
 */
export function proratedMonthlyPrice(start: string | Date, monthlyRate: number = MONTHLY_RATE): number {
  const d = new Date(start)
  const totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() // days in month
  const dayOfMonth = d.getDate()
  const remaining = totalDays - dayOfMonth + 1 // include start day
  if (remaining >= totalDays) return monthlyRate
  return Math.round((monthlyRate * remaining) / totalDays)
}

/**
 * Calculate the new expiry date and price when renewing a monthly pass.
 * - If already expired, renews from today until the end of the current month (pro-rated).
 * - If still active, extends to the end of the next month (full monthly rate).
 */
export function renewMonthEndAndPrice(
  currentEndDate: string,
  now: Date = new Date(),
  monthlyRate: number = MONTHLY_RATE,
): { end: Date; price: number } {
  if (endOfDay(currentEndDate).getTime() < now.getTime()) {
    return { end: monthEndDate(now), price: proratedMonthlyPrice(now, monthlyRate) }
  }
  const curEnd = new Date(currentEndDate)
  const nextMonthStart = new Date(curEnd.getFullYear(), curEnd.getMonth() + 1, 1)
  return { end: monthEndDate(nextMonthStart), price: monthlyRate }
}

export function planEndDate(plan: PlanId, start: string): string {
  const date = new Date(start)
  if (plan === 'daily') {
    return addDays(date, 1).toISOString()
  }
  // All non-daily plans expire on the 1st of the next month
  return monthEndDate(date).toISOString()
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function lastNDays(n: number, from: Date = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() - (n - 1 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\n')
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function hasUserActivation(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  return nav.userActivation ? nav.userActivation.hasBeenActive : true
}
