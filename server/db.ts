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
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 120,
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
    slot TEXT,
    photo TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_passes_token ON passes(token);
  CREATE INDEX IF NOT EXISTS idx_passes_vehicle ON passes(vehicle);
  CREATE INDEX IF NOT EXISTS idx_passes_end ON passes(end_date);

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
`)
