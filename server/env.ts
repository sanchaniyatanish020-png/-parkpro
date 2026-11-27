import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) {
    try {
      process.loadEnvFile(path)
    } catch {
      /* malformed env file — fall back to defaults */
    }
  }
}

const isProd = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET?.trim() || (isProd ? '' : 'parkpro-dev-secret-change-me')

if (isProd && jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a random string of at least 32 characters when NODE_ENV=production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  )
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  dbPath: process.env.DB_PATH ?? resolve(process.cwd(), 'data', 'parkpro.db'),
  demoLogin: process.env.DEMO_LOGIN ? process.env.DEMO_LOGIN === 'true' : !isProd,
  isProd,
  tokenTtl: '7d' as const,
  whatsappToken: process.env.WHATSAPP_TOKEN?.trim() ?? '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? '',
  reminderCronSecret: process.env.REMINDER_CRON_SECRET?.trim() ?? '',
}

export const whatsappConfigured = Boolean(env.whatsappToken && env.whatsappPhoneId)
