import { Router } from 'express'
import { authenticate, requirePermission } from '../auth'
import { getSite, updateSite } from '../repository'
import { asObject, num, optionalStr } from '../validate'

const router = Router()
router.use(authenticate)

router.get('/', (_req, res) => {
  res.json({ site: getSite() })
})

router.patch('/', requirePermission('siteSettings'), (req, res) => {
  const body = asObject(req.body)
  const name = optionalStr(body.name, 'Site name', 80)
  const capacity = body.capacity == null ? undefined : num(body.capacity, 'Capacity', { min: 1, max: 100_000 })
  const monthlyRate = body.monthlyRate == null ? undefined : num(body.monthlyRate, 'Monthly pass amount', { min: 1, max: 1_000_000 })
  res.json({ site: updateSite({ name, capacity, monthlyRate }) })
})

export default router
