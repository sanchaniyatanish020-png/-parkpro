import { Router } from 'express'
import { hasPermission } from '../../src/lib/permissions'
import { authenticate } from '../auth'
import { getSite, listLogs, listPasses, listScans, listWalkIns } from '../repository'

const router = Router()
router.use(authenticate)

/** Single request that hydrates the client cache after sign-in. */
router.get('/', (req, res) => {
  const user = req.user!
  const allow = (perms: Parameters<typeof hasPermission>[2][]) =>
    perms.some((perm) => hasPermission(user.role, user.permissions, perm))

  res.json({
    site: getSite(),
    user,
    passes: allow(['passes', 'managePasses', 'scan', 'parked', 'history', 'dashboard', 'revenue', 'reports']) ? listPasses() : [],
    scans: allow(['scan', 'parked', 'history', 'dashboard', 'revenue', 'reports']) ? listScans() : [],
    walkins: allow(['walkin', 'parked', 'history', 'dashboard', 'revenue', 'reports']) ? listWalkIns() : [],
    logs: allow(['employees', 'dashboard', 'revenue', 'reports']) ? listLogs() : [],
    at: new Date().toISOString(),
  })
})

export default router
