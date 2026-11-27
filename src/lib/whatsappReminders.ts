import type { Pass, ReminderWindowType } from '@/types'
import { formatDate, formatPlate } from '@/lib/utils'

export interface WhatsappCustomerItem {
  pass: Pass
  windowType: ReminderWindowType
  daysRemaining: number
  phoneValid: boolean
  formattedPhone: string
  message: string
  waUrl: string | null
}

/** Format Indian phone number as 91XXXXXXXXXX or null if invalid */
export function formatWhatsappPhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.slice(1))) {
    return `91${digits.slice(1)}`
  }
  return null
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 86_400_000

function istDayKey(value: string | Date): number {
  const shifted = new Date(new Date(value).getTime() + IST_OFFSET_MS)
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
}

/** Calculate calendar day difference between now and pass endDate in IST */
export function getExpiryDaysRemaining(endDate: string, now: Date = new Date()): number {
  return Math.round((istDayKey(endDate) - istDayKey(now)) / DAY_MS)
}

export function classifyExpiryWindow(daysRemaining: number): ReminderWindowType | null {
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining === 0) return 'today'
  if (daysRemaining === 1) return '1_day'
  if (daysRemaining <= 3) return '3_days'
  return null
}

export function buildWhatsappTemplate(
  pass: Pass,
  windowType: ReminderWindowType,
  siteName: string,
  lang: 'en' | 'hi' | 'gu' = 'en',
): string {
  const customerName = pass.name?.trim() || 'Valued Customer'
  const vehicleNumber = formatPlate(pass.vehicle)
  const passType = pass.plan ? pass.plan.replace('_', ' ').toUpperCase() : 'MONTHLY'
  const expiryDate = formatDate(pass.endDate, lang)

  if (windowType === '3_days') {
    return [
      `Hello ${customerName}!`,
      ``,
      `Your parking pass is going to expire soon in 3 days.`,
      `- Vehicle Number: ${vehicleNumber}`,
      `- Pass Type: ${passType}`,
      `- Expiry Date: ${expiryDate}`,
      ``,
      `Please renew your parking pass to continue using our parking facility without interruption.`,
      ``,
      `Thank you!`,
      `${siteName || 'ParkPro'} Parking Management`,
    ].join('\n')
  }

  if (windowType === '1_day') {
    return [
      `Hello ${customerName}!`,
      ``,
      `URGENT REMINDER: Your parking pass will expire TOMORROW!`,
      `- Vehicle Number: ${vehicleNumber}`,
      `- Pass Type: ${passType}`,
      `- Expiry Date: ${expiryDate}`,
      ``,
      `Please renew your pass today to ensure hassle-free entry and exit at the gate.`,
      ``,
      `Thank you!`,
      `${siteName || 'ParkPro'} Parking Management`,
    ].join('\n')
  }

  if (windowType === 'today') {
    return [
      `Hello ${customerName}!`,
      ``,
      `FINAL REMINDER: Your parking pass is EXPIRING TODAY!`,
      `- Vehicle Number: ${vehicleNumber}`,
      `- Pass Type: ${passType}`,
      `- Expiry Date: ${expiryDate} (Today)`,
      ``,
      `Kindly renew your parking pass immediately to avoid daily parking charges or gate delays.`,
      ``,
      `Thank you!`,
      `${siteName || 'ParkPro'} Parking Management`,
    ].join('\n')
  }

  // Pass already expired
  return [
    `Hello ${customerName}!`,
    ``,
    `NOTICE: Your parking pass has EXPIRED on ${expiryDate}.`,
    `- Vehicle Number: ${vehicleNumber}`,
    `- Pass Type: ${passType}`,
    ``,
    `To continue using our parking facility, please renew your pass as soon as possible.`,
    ``,
    `Thank you!`,
    `${siteName || 'ParkPro'} Parking Management`,
  ].join('\n')
}

export function buildWhatsappClickToChatUrl(phone: string, text: string): string | null {
  const formatted = formatWhatsappPhone(phone)
  if (!formatted) return null
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`
}
