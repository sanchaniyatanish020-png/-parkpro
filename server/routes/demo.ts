import { Router } from 'express'
import { authenticate, requireRole } from '../auth'
import { listPasses } from '../repository'
import { resetDemoData } from '../seed'
import { appendLog } from '../log'

const router = Router()
router.use(authenticate, requireRole('owner'))

router.post('/reset', (_req, res) => {
  resetDemoData()
  appendLog('system', 'Demo data restored by owner', 'warn')
  res.json({ ok: true, passes: listPasses().length })
})

export default router
