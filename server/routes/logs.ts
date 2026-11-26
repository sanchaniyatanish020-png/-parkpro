import { Router } from 'express'
import { authenticate, requirePermission, requireRole } from '../auth'
import { parseLogBody } from '../parsers'
import { clearLogs, insertLog, listLogs } from '../repository'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('employees', 'dashboard', 'revenue', 'reports'), (_req, res) => {
  res.json({ logs: listLogs() })
})

router.post('/', (req, res) => {
  const log = parseLogBody(req.body)
  insertLog(log)
  res.status(201).json({ log })
})

router.delete('/', requireRole('owner'), (_req, res) => {
  clearLogs()
  res.json({ ok: true })
})

export default router
