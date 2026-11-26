import { Router } from 'express'
import { hasPermission } from '../../src/lib/permissions'
import { authenticate } from '../auth'
import { parseScanBody, parseWalkInBody } from '../parsers'
import { upsertScan, upsertWalkIn } from '../repository'
import { asObject, fail } from '../validate'

const router = Router()
router.use(authenticate)

/** Uploads records captured while the gate device was offline. */
router.post('/', (req, res) => {
  const body = asObject(req.body)
  const scans = Array.isArray(body.scans) ? body.scans.slice(0, 500).map(parseScanBody) : []
  const walkins = Array.isArray(body.walkins) ? body.walkins.slice(0, 500).map(parseWalkInBody) : []

  if (scans.length > 0 && !hasPermission(req.user!.role, req.user!.permissions, 'scan')) {
    fail(403, 'You do not have permission to upload scan events')
  }
  if (walkins.length > 0 && !hasPermission(req.user!.role, req.user!.permissions, 'walkin')) {
    fail(403, 'You do not have permission to upload walk-in entries')
  }

  scans.forEach(upsertScan)
  walkins.forEach((entry) => {
    entry.collectedBy = entry.collectedBy ?? req.user!.name
    entry.collectedByUsername = entry.collectedByUsername ?? req.user!.username
    upsertWalkIn(entry)
  })

  res.json({ scans: scans.length, walkins: walkins.length, at: new Date().toISOString() })
})

export default router
