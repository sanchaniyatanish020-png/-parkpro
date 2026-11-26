import { Router } from 'express'
import { authenticate, requirePermission } from '../auth'
import { parseWalkInBody } from '../parsers'
import { listWalkIns, upsertWalkIn } from '../repository'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('history', 'walkin', 'parked', 'dashboard', 'revenue', 'reports'), (_req, res) => {
  res.json({ walkins: listWalkIns() })
})

router.post('/', requirePermission('walkin'), (req, res) => {
  const entry = parseWalkInBody(req.body)
  entry.collectedBy = req.user!.name
  entry.collectedByUsername = req.user!.username
  upsertWalkIn(entry)
  res.status(201).json({ walkin: entry })
})

export default router
