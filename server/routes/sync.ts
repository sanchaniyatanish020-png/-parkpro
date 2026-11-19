import { Router } from 'express'
import { authenticate } from '../auth'
import { parseScanBody, parseWalkInBody } from '../parsers'
import { upsertScan, upsertWalkIn } from '../repository'
import { asObject } from '../validate'

const router = Router()
router.use(authenticate)

/** Uploads records captured while the gate device was offline. */
router.post('/', (req, res) => {
  const body = asObject(req.body)
  const scans = Array.isArray(body.scans) ? body.scans.slice(0, 500).map(parseScanBody) : []
  const walkins = Array.isArray(body.walkins) ? body.walkins.slice(0, 500).map(parseWalkInBody) : []

  scans.forEach(upsertScan)
  walkins.forEach(upsertWalkIn)

  res.json({ scans: scans.length, walkins: walkins.length, at: new Date().toISOString() })
})

export default router
