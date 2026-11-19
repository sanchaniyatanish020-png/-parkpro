import type { AuditLog } from '../src/types'
import { uid } from '../src/lib/utils'
import { insertLog } from './repository'

export function appendLog(
  kind: AuditLog['kind'],
  message: string,
  level: AuditLog['level'] = 'info',
  meta?: AuditLog['meta'],
): void {
  insertLog({ id: uid('log_'), kind, message, at: new Date().toISOString(), level, meta })
}
