import { Router } from 'express'
import { authenticate, requireRole } from '../auth'
import { getSite, updateSite } from '../repository'
import { asObject, num, optionalStr } from '../validate'

const router = Router()
router.use(authenticate)

router.get('/', (_req, res) => {
  res.json({ site: getSite() })
})

router.patch('/', requireRole('owner'), (req, res) => {
  const body = asObject(req.body)
  const name = optionalStr(body.name, 'Site name', 80)
  const capacity = body.capacity == null ? undefined : num(body.capacity, 'Capacity', { min: 1, max: 100_000 })
  res.json({ site: updateSite({ name, capacity }) })
})

export default router
