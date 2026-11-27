import { Router } from 'express'
import { hasPermission } from '../../src/lib/permissions'
import { authenticate } from '../auth'
import { whatsappConfigured } from '../env'
import { getSite, listLogs, listPasses, listReminders, listScans, listWalkIns } from '../repository'

const router = Router()
router.use(authenticate)

/** Single request that hydrates the client cache after sign-in. */
router.get('/', (req, res) => {
  const user = req.user!
  const allow = (perms: Parameters<typeof hasPermission>[2][]) =>
    perms.some((perm) => hasPermission(user.role, user.permissions, perm))

  res.json({
    site: { ...getSite(), whatsappConfigured },
    user,
    passes: allow(['passes', 'managePasses', 'scan', 'parked', 'history', 'dashboard', 'revenue', 'reports']) ? listPasses() : [],
    scans: allow(['scan', 'parked', 'history', 'dashboard', 'revenue', 'reports']) ? listScans() : [],
    walkins: allow(['walkin', 'parked', 'history', 'dashboard', 'revenue', 'reports']) ? listWalkIns() : [],
    logs: allow(['employees', 'dashboard', 'revenue', 'reports']) ? listLogs() : [],
    reminders: allow(['passes', 'managePasses', 'dashboard']) ? listReminders() : [],
    at: new Date().toISOString(),
  })
})

export default router
