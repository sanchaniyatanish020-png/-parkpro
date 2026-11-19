import { Router } from 'express'
import { authenticate } from '../auth'
import { parseWalkInBody } from '../parsers'
import { listWalkIns, upsertWalkIn } from '../repository'

const router = Router()
router.use(authenticate)

router.get('/', (_req, res) => {
  res.json({ walkins: listWalkIns() })
})

router.post('/', (req, res) => {
  const entry = parseWalkInBody(req.body)
  upsertWalkIn(entry)
  res.status(201).json({ walkin: entry })
})

export default router
