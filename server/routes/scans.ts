import { Router } from 'express'
import type { Direction, ScanEvent, ScanOutcome } from '../../src/types'
import { daysLeft, passStatus, uid } from '../../src/lib/utils'
import { authenticate, requirePermission } from '../auth'
import { parseScanBody } from '../parsers'
import { findPassByQuery, lastRealScan, listScans, upsertScan } from '../repository'
import { asObject, oneOf, str } from '../validate'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('history', 'parked', 'scan', 'dashboard', 'revenue', 'reports'), (_req, res) => {
  res.json({ scans: listScans() })
})

/** Gate decision: looks up the pass, alternates IN/OUT and records the event. */
router.post('/scan', requirePermission('scan'), (req, res) => {
  const body = asObject(req.body)
  const text = str(body.text, 'Pass code', { max: 512 })
  const source = oneOf(body.source, 'Source', ['camera', 'manual'] as const)
  const at = new Date().toISOString()

  const pass = findPassByQuery(text)
  if (!pass) {
    const event: ScanEvent = {
      id: uid('s_'),
      token: text.slice(0, 48),
      direction: 'DENIED',
      outcome: 'unknown',
      at,
      source,
      synced: true,
    }
    upsertScan(event)
    res.json({ outcome: event.outcome, direction: event.direction, at, message: text.slice(0, 48), event })
    return
  }

  const status = passStatus(pass)
  const last = lastRealScan(pass.id)
  const nextDirection: Direction = last?.direction === 'IN' ? 'OUT' : 'IN'
  const outcome: ScanOutcome = status === 'expired' ? 'expired' : status === 'expiring' ? 'expiring' : 'success'
  const direction: Direction = status === 'expired' ? 'DENIED' : nextDirection

  const event: ScanEvent = {
    id: uid('s_'),
    passId: pass.id,
    token: pass.token,
    name: pass.name,
    phone: pass.phone,
    vehicle: pass.vehicle,
    photo: pass.photo,
    direction,
    outcome,
    at,
    source,
    synced: true,
  }
  upsertScan(event)

  res.json({ outcome, direction, pass, daysLeft: daysLeft(pass.endDate), at, event })
})

/** Records an event produced while the device was offline. */
router.post('/', requirePermission('scan'), (req, res) => {
  const event = parseScanBody(req.body)
  upsertScan(event)
  res.status(201).json({ scan: event })
})

export default router
