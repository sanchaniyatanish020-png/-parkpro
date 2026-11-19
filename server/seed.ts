import { randomBytes } from 'node:crypto'
import type { AuditLog, Pass, ScanEvent, WalkIn } from '../src/types'
import { addDays, addMonths, formatPlate, isoDate, PLAN_MONTHS, PLAN_PRICE, uid } from '../src/lib/utils'
import { hashPassword } from './auth'
import { env } from './env'
import {
  clearAllData,
  countUsers,
  getSite,
  insertLog,
  insertUser,
  listPasses,
  updateSite,
  upsertPass,
  upsertScan,
  upsertWalkIn,
} from './repository'

const DEMO_USERS = [
  { username: 'admin', passwordEnv: 'SEED_ADMIN_PASSWORD', devPassword: 'admin123', role: 'owner' as const, name: 'Bhavesh Porva' },
  { username: 'staff', passwordEnv: 'SEED_STAFF_PASSWORD', devPassword: 'staff123', role: 'staff' as const, name: 'Arjun Rathod' },
]

function initialPassword(user: (typeof DEMO_USERS)[number]): string {
  const fromEnv = process.env[user.passwordEnv]?.trim()
  if (fromEnv && fromEnv.length >= 8) return fromEnv
  if (!env.isProd) return user.devPassword
  const generated = randomBytes(9).toString('base64url')
  console.warn(
    `[seed] ${user.passwordEnv} is not set. Generated password for "${user.username}": ${generated} — save it and change it after the first sign-in.`,
  )
  return generated
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = [
  'Rakesh Patel', 'Meera Shah', 'Amit Desai', 'Priya Joshi', 'Kiran Trivedi',
  'Nilesh Chauhan', 'Hetal Mehta', 'Jignesh Solanki', 'Pooja Bhatt', 'Vipul Parmar',
  'Sneha Vyas', 'Rohit Panchal', 'Anjali Pandya', 'Manish Rawal', 'Dhara Thakkar',
  'Bhavesh Modi', 'Kavita Prajapati', 'Suresh Damor', 'Nidhi Kapadia', 'Yash Suthar',
  'Trupti Mistry', 'Dinesh Bhoi', 'Aarti Rathod', 'Prakash Gohil', 'Rina Makwana',
  'Sanjay Varma', 'Payal Thakor', 'Jayesh Ahir', 'Mitali Doshi', 'Chirag Naik',
  'Falguni Shah', 'Hardik Pandya', 'Ishita Dave', 'Kunal Barot', 'Lata Solanki',
  'Mahesh Vaghela', 'Nisha Parmar', 'Om Bhatt', 'Parth Chauhan', 'Ritu Jain',
  'Sagar Patel', 'Tanvi Desai', 'Umesh Rana', 'Vidhi Shah', 'Wasim Sheikh',
  'Yamini Joshi', 'Zeel Mehta', 'Alka Trivedi', 'Bharat Makwana', 'Chetna Vyas',
  'Devang Pandya', 'Esha Dave', 'Gaurav Soni', 'Hina Qureshi', 'Imran Malek',
  'Jalpa Thakkar',
]

const PLATES_LEFT = ['GJ01', 'GJ05', 'GJ06', 'GJ18', 'GJ27', 'GJ12', 'GJ03']
const PLATE_LETTERS = ['AB', 'AK', 'BC', 'CD', 'DF', 'ER', 'FG', 'GH', 'HJ', 'JK', 'KL', 'MN', 'NP', 'PQ', 'RS', 'TU', 'VW', 'XY', 'ZA', 'BK', 'CP', 'DT']
const VEHICLE_TYPES = ['car', 'car', 'car', 'suv', 'bike', 'bike', 'ev'] as const
const PLANS = ['monthly', 'monthly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'daily'] as const
const SLOT_LETTERS = ['A', 'B', 'C', 'D']

function plate(rnd: () => number): string {
  const left = PLATES_LEFT[Math.floor(rnd() * PLATES_LEFT.length)]
  const letters = PLATE_LETTERS[Math.floor(rnd() * PLATE_LETTERS.length)]
  const digits = String(1000 + Math.floor(rnd() * 8999))
  return formatPlate(`${left}${letters}${digits}`)
}

function phone(rnd: () => number): string {
  return `9${Math.floor(rnd() * 9)}${String(Math.floor(rnd() * 100000000)).padStart(8, '0')}`
}

function token(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `PRKP-${out}`
}

function seedUsers(): void {
  const now = new Date().toISOString()
  for (const user of DEMO_USERS) {
    insertUser({
      id: uid('u_'),
      username: user.username,
      passwordHash: hashPassword(initialPassword(user)),
      role: user.role,
      name: user.name,
      createdAt: now,
    })
  }
}

function seedSite(): void {
  const site = getSite()
  updateSite({ name: site.name || 'Riverfront Parking', capacity: site.capacity || 120 })
}

function seedDemoData(): void {
  const rnd = mulberry32(20261108)
  const now = new Date()
  const passes: Pass[] = []
  const scans: ScanEvent[] = []
  const walkins: WalkIn[] = []
  const logs: AuditLog[] = []

  const pushLog = (kind: AuditLog['kind'], message: string, at: Date | string, level: AuditLog['level'] = 'info') => {
    logs.push({ id: uid('log_'), kind, message, at: new Date(at).toISOString(), level })
  }

  for (let i = 0; i < 56; i += 1) {
    const name = NAMES[i % NAMES.length]
    const type = VEHICLE_TYPES[Math.floor(rnd() * VEHICLE_TYPES.length)]
    const vehicle = plate(rnd)
    let plan = PLANS[Math.floor(rnd() * PLANS.length)]
    let start: Date
    let end: Date

    if (i < 3) {
      end = addDays(now, -(2 + Math.floor(rnd() * 12)))
      start = addMonths(end, -Math.max(1, PLAN_MONTHS[plan]))
    } else if (i < 9) {
      end = addDays(now, 1 + Math.floor(rnd() * 3))
      start = addMonths(end, -Math.max(1, PLAN_MONTHS[plan]))
    } else if (i < 13) {
      plan = 'daily'
      start = new Date(now.getTime() - rnd() * 4 * 3600_000)
      end = addDays(now, 1 + Math.floor(rnd() * 2))
    } else if (i < 22) {
      plan = rnd() > 0.4 ? 'monthly' : 'quarterly'
      start = new Date(now.getTime() - (0.2 + rnd() * 6) * 86_400_000)
      end = addMonths(start, PLAN_MONTHS[plan])
    } else if (i < 40) {
      start = new Date(now.getTime() - (20 + rnd() * 170) * 86_400_000)
      end = addMonths(start, PLAN_MONTHS[plan])
      if (end.getTime() < now.getTime() + 5 * 86_400_000) end = addDays(now, 10 + Math.floor(rnd() * 80))
    } else {
      if (plan === 'daily') plan = 'monthly'
      start = new Date(now.getTime() - Math.floor(rnd() * 40) * 86_400_000)
      end = addMonths(start, Math.max(1, PLAN_MONTHS[plan]))
      if (end.getTime() < now.getTime() + 20 * 86_400_000) {
        end = addDays(now, 20 + Math.floor(rnd() * 300))
      }
    }

    passes.push({
      id: `p_${i + 1}`,
      token: token(),
      name,
      phone: phone(rnd),
      vehicle,
      vehicleType: type,
      plan,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      amount: PLAN_PRICE[plan],
      slot: `${SLOT_LETTERS[Math.floor(rnd() * SLOT_LETTERS.length)]}-${String(1 + Math.floor(rnd() * 96)).padStart(2, '0')}`,
      createdAt: start.toISOString(),
      updatedAt: start.toISOString(),
      notes: i % 9 === 0 ? 'Prefers covered parking' : undefined,
    })
  }

  const parkedCandidates = passes.slice(9, 37)
  parkedCandidates.forEach((pass, index) => {
    const hoursAgo = index < 4 ? 12.5 + rnd() * 2 : 0.4 + rnd() * 9
    scans.push({
      id: uid('s_'),
      passId: pass.id,
      token: pass.token,
      name: pass.name,
      phone: pass.phone,
      vehicle: pass.vehicle,
      direction: 'IN',
      outcome: 'success',
      at: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
      source: index % 5 === 0 ? 'manual' : 'camera',
      synced: true,
    })
  })

  for (let day = 7; day >= 1; day -= 1) {
    const count = 8 + Math.floor(rnd() * 10)
    for (let n = 0; n < count; n += 1) {
      const pass = passes[Math.floor(rnd() * passes.length)]
      const inAt = new Date(now)
      inAt.setDate(inAt.getDate() - day)
      inAt.setHours(7 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0)
      const outAt = new Date(inAt.getTime() + (30 + Math.floor(rnd() * 300)) * 60_000)
      const expired = new Date(pass.endDate).getTime() < inAt.getTime()
      scans.push({
        id: uid('s_'),
        passId: pass.id,
        token: pass.token,
        name: pass.name,
        phone: pass.phone,
        vehicle: pass.vehicle,
        direction: 'IN',
        outcome: expired ? 'expired' : 'success',
        at: inAt.toISOString(),
        source: 'camera',
        synced: true,
      })
      if (!expired) {
        scans.push({
          id: uid('s_'),
          passId: pass.id,
          token: pass.token,
          name: pass.name,
          phone: pass.phone,
          vehicle: pass.vehicle,
          direction: 'OUT',
          outcome: 'success',
          at: outAt.toISOString(),
          source: 'camera',
          synced: true,
        })
      }
    }
  }

  NAMES.slice(40, 50).forEach((name, index) => {
    const at = new Date(now)
    at.setHours(8 + index, 10 + index * 3, 0, 0)
    if (at.getTime() > now.getTime()) at.setTime(now.getTime() - (index + 1) * 600_000)
    walkins.push({
      id: uid('w_'),
      name,
      phone: phone(rnd),
      vehicle: index % 3 === 0 ? undefined : plate(rnd),
      vehicleType: index % 2 === 0 ? 'car' : 'bike',
      amount: index % 2 === 0 ? 60 : 40,
      at: at.toISOString(),
      synced: true,
    })
  })

  pushLog('system', 'Demo site “Riverfront Parking” initialised', addDays(now, -8), 'info')
  pushLog('pass', '56 passes imported from the old register', addDays(now, -7), 'success')
  pushLog('sync', 'Offline queue synced after a network drop', addDays(now, -2), 'success')
  pushLog('scan', 'Gate scanner opened for the morning shift', now, 'info')

  passes.slice(3, 9).forEach((pass, index) => {
    pushLog(
      'pass',
      `${pass.name} · ${pass.vehicle} expires in ${index + 1} day${index === 0 ? '' : 's'}`,
      new Date(now.getTime() - (index + 1) * 3600_000),
      'warn',
    )
  })

  passes.forEach(upsertPass)
  scans.forEach(upsertScan)
  walkins.forEach(upsertWalkIn)
  logs.forEach(insertLog)

  updateSite({ name: 'Riverfront Parking', capacity: 120 })
  console.info(`Seeded demo data: ${passes.length} passes, ${scans.length} scans, ${walkins.length} walk-ins`)
}

export function seedIfEmpty(): void {
  if (countUsers() === 0) seedUsers()
  seedSite()
  if (listPasses().length === 0) seedDemoData()
}

export function resetDemoData(): void {
  clearAllData()
  seedDemoData()
  insertLog({
    id: uid('log_'),
    kind: 'system',
    message: `Demo data restored on ${isoDate(new Date())}`,
    at: new Date().toISOString(),
    level: 'info',
  })
}
