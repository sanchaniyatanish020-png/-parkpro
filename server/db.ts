import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from './env'

mkdirSync(dirname(env.dbPath), { recursive: true })

export const db = new DatabaseSync(env.dbPath)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA busy_timeout = 5000')
db.exec('PRAGMA temp_store = MEMORY')
db.exec('PRAGMA cache_size = -16000')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    permissions TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 120,
    monthly_rate INTEGER NOT NULL DEFAULT 1800,
    rate_car INTEGER NOT NULL DEFAULT 1800,
    rate_suv INTEGER NOT NULL DEFAULT 1800,
    rate_bike INTEGER NOT NULL DEFAULT 1200,
    rate_ev INTEGER NOT NULL DEFAULT 1800,
    upi_id TEXT NOT NULL DEFAULT '',
    upi_name TEXT NOT NULL DEFAULT '',
    reminders_enabled INTEGER NOT NULL DEFAULT 0,
    reminder_days INTEGER NOT NULL DEFAULT 3,
    whatsapp_template TEXT NOT NULL DEFAULT '',
    whatsapp_lang TEXT NOT NULL DEFAULT 'en',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS passes (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    plan TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    collected_by TEXT,
    collected_by_username TEXT,
    slot TEXT,
    photo TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_passes_token ON passes(token);
  CREATE INDEX IF NOT EXISTS idx_passes_vehicle ON passes(vehicle);
  CREATE INDEX IF NOT EXISTS idx_passes_end ON passes(end_date);

  CREATE TABLE IF NOT EXISTS pass_reminders (
    id TEXT PRIMARY KEY,
    pass_id TEXT NOT NULL REFERENCES passes(id) ON DELETE CASCADE,
    end_date TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('manual', 'whatsapp', 'click_to_chat')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'opened', 'skipped')),
    reminder_type TEXT NOT NULL DEFAULT 'expiring',
    message TEXT NOT NULL DEFAULT '',
    error TEXT,
    at TEXT NOT NULL,
    by_name TEXT,
    by_username TEXT,
    UNIQUE(pass_id, end_date, reminder_type)
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_at ON pass_reminders(at);
  CREATE INDEX IF NOT EXISTS idx_reminders_pass ON pass_reminders(pass_id, end_date);

  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    pass_id TEXT,
    token TEXT,
    name TEXT,
    phone TEXT,
    vehicle TEXT,
    photo TEXT,
    direction TEXT NOT NULL,
    outcome TEXT NOT NULL,
    at TEXT NOT NULL,
    source TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_scans_at ON scans(at);
  CREATE INDEX IF NOT EXISTS idx_scans_pass ON scans(pass_id);

  CREATE TABLE IF NOT EXISTS walkins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle TEXT,
    vehicle_type TEXT NOT NULL,
    photo TEXT,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    collected_by TEXT,
    collected_by_username TEXT,
    at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_walkins_at ON walkins(at);

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    at TEXT NOT NULL,
    level TEXT NOT NULL,
    meta TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_logs_at ON logs(at);

  CREATE TABLE IF NOT EXISTS employee_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    login_at TEXT NOT NULL,
    logout_at TEXT,
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_emp_sessions_user ON employee_sessions(user_id, login_at);

  CREATE TABLE IF NOT EXISTS employee_leaves (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    leave_date TEXT NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'full' CHECK (leave_type IN ('full', 'half')),
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    created_by TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, leave_date)
  );
  CREATE INDEX IF NOT EXISTS idx_emp_leaves_user ON employee_leaves(user_id, leave_date);

  CREATE TABLE IF NOT EXISTS login_lockouts (
    account_key TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 0,
    last_failed_at TEXT,
    locked_until TEXT,
    last_success_at TEXT,
    last_ip TEXT
  );

  CREATE TABLE IF NOT EXISTS login_events (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    user_id TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failed', 'locked')),
    ip TEXT,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_login_events_at ON login_events(at);
`)

const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
if (!userColumns.some((col) => col.name === 'active')) {
  db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1')
}
if (!userColumns.some((col) => col.name === 'permissions')) {
  db.exec('ALTER TABLE users ADD COLUMN permissions TEXT')
}
if (!userColumns.some((col) => col.name === 'hourly_rate')) {
  db.exec('ALTER TABLE users ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0')
}
if (!userColumns.some((col) => col.name === 'monthly_salary')) {
  db.exec('ALTER TABLE users ADD COLUMN monthly_salary REAL NOT NULL DEFAULT 0')
}
const leaveColumns = db.prepare('PRAGMA table_info(employee_leaves)').all() as { name: string }[]
if (!leaveColumns.some((col) => col.name === 'status')) {
  db.exec("ALTER TABLE employee_leaves ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'")
}
if (!leaveColumns.some((col) => col.name === 'reviewed_by')) {
  db.exec('ALTER TABLE employee_leaves ADD COLUMN reviewed_by TEXT')
}
if (!leaveColumns.some((col) => col.name === 'reviewed_at')) {
  db.exec('ALTER TABLE employee_leaves ADD COLUMN reviewed_at TEXT')
}
const passColumns = db.prepare('PRAGMA table_info(passes)').all() as { name: string }[]
if (!passColumns.some((col) => col.name === 'payment_mode')) {
  db.exec("ALTER TABLE passes ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'cash'")
}
if (!passColumns.some((col) => col.name === 'transaction_id')) {
  db.exec('ALTER TABLE passes ADD COLUMN transaction_id TEXT')
}
if (!passColumns.some((col) => col.name === 'collected_by')) {
  db.exec('ALTER TABLE passes ADD COLUMN collected_by TEXT')
}
if (!passColumns.some((col) => col.name === 'collected_by_username')) {
  db.exec('ALTER TABLE passes ADD COLUMN collected_by_username TEXT')
}
const walkinColumns = db.prepare('PRAGMA table_info(walkins)').all() as { name: string }[]
if (!walkinColumns.some((col) => col.name === 'payment_mode')) {
  db.exec("ALTER TABLE walkins ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'cash'")
}
if (!walkinColumns.some((col) => col.name === 'collected_by')) {
  db.exec('ALTER TABLE walkins ADD COLUMN collected_by TEXT')
}
if (!walkinColumns.some((col) => col.name === 'collected_by_username')) {
  db.exec('ALTER TABLE walkins ADD COLUMN collected_by_username TEXT')
}
const siteColumns = db.prepare('PRAGMA table_info(site)').all() as { name: string }[]
if (!siteColumns.some((col) => col.name === 'monthly_rate')) {
  db.exec('ALTER TABLE site ADD COLUMN monthly_rate INTEGER NOT NULL DEFAULT 1800')
}
if (!siteColumns.some((col) => col.name === 'rate_car')) {
  db.exec('ALTER TABLE site ADD COLUMN rate_car INTEGER NOT NULL DEFAULT 1800')
}
if (!siteColumns.some((col) => col.name === 'rate_suv')) {
  db.exec('ALTER TABLE site ADD COLUMN rate_suv INTEGER NOT NULL DEFAULT 1800')
}
if (!siteColumns.some((col) => col.name === 'rate_bike')) {
  db.exec('ALTER TABLE site ADD COLUMN rate_bike INTEGER NOT NULL DEFAULT 1200')
}
if (!siteColumns.some((col) => col.name === 'rate_ev')) {
  db.exec('ALTER TABLE site ADD COLUMN rate_ev INTEGER NOT NULL DEFAULT 1800')
}
if (!siteColumns.some((col) => col.name === 'upi_id')) {
  db.exec("ALTER TABLE site ADD COLUMN upi_id TEXT NOT NULL DEFAULT ''")
}
if (!siteColumns.some((col) => col.name === 'upi_name')) {
  db.exec("ALTER TABLE site ADD COLUMN upi_name TEXT NOT NULL DEFAULT ''")
}
if (!siteColumns.some((col) => col.name === 'reminders_enabled')) {
  db.exec('ALTER TABLE site ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 0')
}
if (!siteColumns.some((col) => col.name === 'reminder_days')) {
  db.exec('ALTER TABLE site ADD COLUMN reminder_days INTEGER NOT NULL DEFAULT 3')
}
if (!siteColumns.some((col) => col.name === 'whatsapp_template')) {
  db.exec("ALTER TABLE site ADD COLUMN whatsapp_template TEXT NOT NULL DEFAULT ''")
}
if (!siteColumns.some((col) => col.name === 'whatsapp_lang')) {
  db.exec("ALTER TABLE site ADD COLUMN whatsapp_lang TEXT NOT NULL DEFAULT 'en'")
}
const reminderColumns = db.prepare('PRAGMA table_info(pass_reminders)').all() as { name: string }[]
if (!reminderColumns.some((col) => col.name === 'reminder_type')) {
  db.exec("ALTER TABLE pass_reminders ADD COLUMN reminder_type TEXT NOT NULL DEFAULT 'expiring'")
}
