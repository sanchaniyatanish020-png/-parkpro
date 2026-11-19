import { Router } from 'express'
import { authenticate } from '../auth'
import { getSite, listLogs, listPasses, listScans, listWalkIns } from '../repository'

const router = Router()
router.use(authenticate)

/** Single request that hydrates the client cache after sign-in. */
router.get('/', (_req, res) => {
  res.json({
    site: getSite(),
    passes: listPasses(),
    scans: listScans(),
    walkins: listWalkIns(),
    logs: listLogs(),
    at: new Date().toISOString(),
  })
})

export default router
