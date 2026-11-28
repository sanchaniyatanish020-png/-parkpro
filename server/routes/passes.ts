import { Router } from 'express'
import { authenticate, requirePermission } from '../auth'
import { parsePassBody } from '../parsers'
import {
  applyKhataTransaction,
  deletePass,
  findActivePassByPhone,
  findActivePassByVehicle,
  getPass,
  listPasses,
  tokenExists,
  upsertPass,
} from '../repository'
import { asObject, fail, num } from '../validate'

const router = Router()
router.use(authenticate)

function generateToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let out = ''
    for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
    const token = `PRKP-${out}`
    if (!tokenExists(token)) return token
  }
  throw new Error('Could not allocate a unique pass code')
}

router.get('/', requirePermission('passes', 'managePasses', 'scan', 'parked', 'history', 'dashboard', 'revenue', 'reports'), (_req, res) => {
  res.json({ passes: listPasses() })
})

router.post('/', requirePermission('managePasses'), (req, res) => {
  const rawBody = asObject(req.body)
  const pass = parsePassBody(rawBody)
  if (!pass.token) pass.token = generateToken()
  else if (tokenExists(pass.token)) fail(409, 'Pass code already in use')
  pass.collectedBy = req.user!.name
  pass.collectedByUsername = req.user!.username

  // Duplicate pass prevention
  const dupPhone = findActivePassByPhone(pass.phone)
  if (dupPhone) fail(409, `An active pass already exists for phone number ${pass.phone} (Pass: ${dupPhone.token})`)
  const dupVehicle = findActivePassByVehicle(pass.vehicle)
  if (dupVehicle) fail(409, `An active pass already exists for vehicle ${pass.vehicle} (Pass: ${dupVehicle.token})`)

  const advanceUsed = rawBody.advanceUsed == null ? 0 : num(rawBody.advanceUsed, 'Advance used', { min: 0, max: 1_000_000 })
  const advanceSaved = rawBody.advanceSaved == null ? 0 : num(rawBody.advanceSaved, 'Advance saved', { min: 0, max: 1_000_000 })

  if (advanceUsed > pass.amount) {
    fail(400, 'Advance used cannot exceed pass amount')
  }

  if (advanceUsed > 0) {
    try {
      applyKhataTransaction({
        phone: pass.phone,
        customerName: pass.name,
        vehicle: pass.vehicle,
        passId: pass.id,
        passToken: pass.token,
        type: 'debit',
        amountUsed: advanceUsed,
        paymentMode: pass.paymentMode,
        description: `Used advance balance for pass ${pass.token}`,
        byName: req.user!.name,
        byUsername: req.user!.username,
      })
    } catch (err) {
      fail(400, err instanceof Error ? err.message : 'Insufficient advance balance')
    }
  }

  if (advanceSaved > 0) {
    applyKhataTransaction({
      phone: pass.phone,
      customerName: pass.name,
      vehicle: pass.vehicle,
      passId: pass.id,
      passToken: pass.token,
      type: 'credit',
      amountAdded: advanceSaved,
      paymentMode: 'cash',
      description: `Saved cash change as advance for pass ${pass.token}`,
      byName: req.user!.name,
      byUsername: req.user!.username,
    })
  }

  upsertPass(pass)
  res.status(201).json({ pass })
})

router.patch('/:id', requirePermission('managePasses'), (req, res) => {
  const existing = getPass(req.params.id)
  if (!existing) fail(404, 'Pass not found')

  const pass = parsePassBody(asObject(req.body), existing)
  if (pass.token !== existing.token) {
    if (tokenExists(pass.token, existing.id)) fail(409, 'Pass code already in use')
  }

  // Duplicate pass prevention (excluding the current pass itself)
  const dupPhone = findActivePassByPhone(pass.phone, existing.id)
  if (dupPhone) fail(409, `An active pass already exists for phone number ${pass.phone} (Pass: ${dupPhone.token})`)
  const dupVehicle = findActivePassByVehicle(pass.vehicle, existing.id)
  if (dupVehicle) fail(409, `An active pass already exists for vehicle ${pass.vehicle} (Pass: ${dupVehicle.token})`)

  pass.collectedBy = existing.collectedBy ?? req.user!.name
  pass.collectedByUsername = existing.collectedByUsername ?? req.user!.username
  upsertPass(pass)
  res.json({ pass })
})

router.delete('/:id', requirePermission('managePasses'), (req, res) => {
  if (!deletePass(req.params.id)) fail(404, 'Pass not found')
  res.json({ ok: true })
})

export default router
