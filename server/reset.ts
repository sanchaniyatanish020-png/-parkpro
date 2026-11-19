import { existsSync, rmSync } from 'node:fs'
import { env } from './env'

for (const suffix of ['', '-wal', '-shm']) {
  const file = env.dbPath + suffix
  if (existsSync(file)) rmSync(file)
}

console.info(`Removed ${env.dbPath}. Demo data is recreated on the next server start.`)
