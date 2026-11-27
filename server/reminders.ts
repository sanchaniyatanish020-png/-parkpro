import type { Pass } from '../src/types'
import { formatPlate } from '../src/lib/utils'
import type { SiteRecord } from './repository'
import { env, whatsappConfigured } from './env'
import { broadcast } from './events'
import { appendLog } from './log'
import { getSite, hasSentReminder, listPasses, recordReminder } from './repository'

const GRAPH_VERSION = 'v21.0'
const DAY = 86_400_000
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

const EXPIRY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

function istDayKey(value: string | Date): number {
  const shifted = new Date(new Date(value).getTime() + IST_OFFSET_MS)
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
}

function daysUntilExpiry(endDate: string, now: Date): number {
  return Math.round((istDayKey(endDate) - istDayKey(now)) / DAY)
}

/** WhatsApp expects the full international number without symbols. */
export function reminderPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

export function expiryLabel(endDate: string): string {
  return EXPIRY_FORMAT.format(new Date(endDate))
}

export function reminderMessage(pass: Pass, site: SiteRecord): string {
  return `Hello ${pass.name}, your pass for ${site.name} expires on ${expiryLabel(pass.endDate)}. Please renew at the gate.`
}

/** Passes inside the reminder window that still have a reachable WhatsApp number. */
export function dueForReminder(days: number, now: Date = new Date()): Pass[] {
  return listPasses()
    .filter((pass) => {
      const left = daysUntilExpiry(pass.endDate, now)
      return left >= 0 && left <= days && reminderPhone(pass.phone) !== null
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
}

async function sendTemplate(pass: Pass, site: SiteRecord): Promise<void> {
  const to = reminderPhone(pass.phone)
  if (!to) throw new Error('Customer phone is not a valid Indian mobile number')

  const template = site.whatsappTemplate || 'pass_expiry_reminder'
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(env.whatsappPhoneId)}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: site.whatsappLang || 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            pass.name,
            formatPlate(pass.vehicle),
            site.name,
            expiryLabel(pass.endDate),
          ].map((text) => ({ type: 'text', text })),
        },
      ],
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsappToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(payload?.error?.message ?? `WhatsApp API responded ${response.status}`)
  }
}

export interface ReminderRunResult {
  configured: boolean
  enabled: boolean
  considered: number
  sent: number
  skipped: number
  failed: number
  error?: string
}

export async function runReminders(options: {
  trigger: 'auto' | 'manual' | 'cron'
  onlyEnabled?: boolean
}): Promise<ReminderRunResult> {
  const site = getSite()
  const due = dueForReminder(site.reminderDays)
  const result: ReminderRunResult = {
    configured: whatsappConfigured,
    enabled: site.remindersEnabled,
    considered: due.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  }

  if (options.onlyEnabled && !site.remindersEnabled) {
    return { ...result, considered: 0, error: 'Automatic reminders are turned off' }
  }
  if (!whatsappConfigured) {
    return { ...result, error: 'WhatsApp Cloud API is not connected' }
  }

  for (const pass of due) {
    if (hasSentReminder(pass.id, pass.endDate)) {
      result.skipped += 1
      continue
    }
    const message = reminderMessage(pass, site)
    try {
      await sendTemplate(pass, site)
      recordReminder({
        passId: pass.id,
        endDate: pass.endDate,
        channel: 'whatsapp',
        status: 'sent',
        message,
        byName: 'Auto reminder',
        byUsername: 'system',
      })
      result.sent += 1
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'WhatsApp send failed'
      recordReminder({
        passId: pass.id,
        endDate: pass.endDate,
        channel: 'whatsapp',
        status: 'failed',
        message,
        error: reason,
        byName: 'Auto reminder',
        byUsername: 'system',
      })
      result.failed += 1
    }
  }

  if (result.sent > 0 || result.failed > 0) {
    appendLog(
      'pass',
      `WhatsApp reminders · ${result.sent} sent · ${result.failed} failed · ${result.skipped} already sent`,
      result.failed > 0 ? 'warn' : 'success',
      { sent: result.sent, failed: result.failed, skipped: result.skipped, trigger: options.trigger },
    )
    broadcast('/api/reminders')
  }
  return result
}

let interval: NodeJS.Timeout | null = null
let initial: NodeJS.Timeout | null = null
let running = false

async function tick() {
  if (running) return
  running = true
  try {
    await runReminders({ trigger: 'auto', onlyEnabled: true })
  } catch (error) {
    console.error('[reminders] scheduled run failed', error)
  } finally {
    running = false
  }
}

/**
 * Business-initiated WhatsApp messages need the Cloud API credentials. The
 * in-process timer is best-effort; a cron can also call POST /api/reminders/cron.
 */
export function startReminderScheduler() {
  if (!whatsappConfigured) {
    console.info('  WhatsApp reminders: not connected (set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)')
    return
  }
  if (interval) return
  initial = setTimeout(() => void tick(), 20_000)
  initial.unref()
  interval = setInterval(() => void tick(), 30 * 60 * 1000)
  interval.unref()
  console.info('  WhatsApp reminders: checking every 30 minutes')
}
