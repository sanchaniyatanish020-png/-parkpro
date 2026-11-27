import type { Pass, ReminderWindowType } from '@/types'
import { formatDate } from '@/lib/utils'

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
  _siteName: string,
  lang: 'en' | 'hi' | 'gu' = 'en',
): string {
  const customerName = pass.name?.trim() || 'Valued Customer'
  const expiryDate = formatDate(pass.endDate, lang)

  if (windowType === '3_days') {
    return [
      `નમસ્તે [${customerName}] !`,
      ``,
      `તમારો પાર્કિંગ પાસ ૩ દિવસમાં સમાપ્ત થવાનો છે.`,
      `* સમાપ્તિ તારીખ: ${expiryDate}`,
      ``,
      `કોઈપણ અડચણ વિના પાર્કિંગ સુવિધાનો ઉપયોગ ચાલુ રાખવા માટે કૃપા કરીને તમારો પાર્કિંગ પાસ રિન્યુ કરાવો.`,
      ``,
      `આભાર!`,
    ].join('\n')
  }

  if (windowType === '1_day') {
    return [
      `નમસ્તે [${customerName}] !`,
      ``,
      `તમારો પાર્કિંગ પાસ આવતીકાલે સમાપ્ત થવાનો છે.`,
      `* સમાપ્તિ તારીખ: ${expiryDate}`,
      ``,
      `કોઈપણ અડચણ વિના પાર્કિંગ સુવિધાનો ઉપયોગ ચાલુ રાખવા માટે કૃપા કરીને તમારો પાર્કિંગ પાસ રિન્યુ કરાવો.`,
      ``,
      `આભાર!`,
    ].join('\n')
  }

  if (windowType === 'today') {
    return [
      `નમસ્તે [${customerName}] !`,
      ``,
      `તમારો પાર્કિંગ પાસ આજે સમાપ્ત થઈ રહ્યો છે.`,
      `* સમાપ્તિ તારીખ: ${expiryDate} (આજે)`,
      ``,
      `કોઈપણ અડચણ વિના પાર્કિંગ સુવિધાનો ઉપયોગ ચાલુ રાખવા માટે કૃપા કરીને તમારો પાર્કિંગ પાસ રિન્યુ કરાવો.`,
      ``,
      `આભાર!`,
    ].join('\n')
  }

  // Pass already expired
  return [
    `નમસ્તે [${customerName}] !`,
    ``,
    `તમારો પાર્કિંગ પાસ સમાપ્ત થઈ ગયો છે.`,
    `* સમાપ્તિ તારીખ: ${expiryDate}`,
    ``,
    `કોઈપણ અડચણ વિના પાર્કિંગ સુવિધાનો ઉપયોગ ચાલુ રાખવા માટે કૃપા કરીને તમારો પાર્કિંગ પાસ રિન્યુ કરાવો.`,
    ``,
    `આભાર!`,
  ].join('\n')
}

export function buildWhatsappClickToChatUrl(phone: string, text: string): string | null {
  const formatted = formatWhatsappPhone(phone)
  if (!formatted) return null
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`
}
