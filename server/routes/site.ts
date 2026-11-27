import { Router } from 'express'
import { authenticate, requirePermission } from '../auth'
import { whatsappConfigured } from '../env'
import { getSite, updateSite } from '../repository'
import { asObject, fail, num, optionalStr, str } from '../validate'

const router = Router()
router.use(authenticate)

const VPA_PATTERN = /^[a-z0-9][a-z0-9._-]{0,60}@[a-z][a-z0-9.-]{1,30}$/

router.get('/', (_req, res) => {
  res.json({ site: { ...getSite(), whatsappConfigured } })
})

router.patch('/', requirePermission('siteSettings', 'managePasses'), (req, res) => {
  const body = asObject(req.body)
  const name = optionalStr(body.name, 'Site name', 80)
  const capacity = body.capacity == null ? undefined : num(body.capacity, 'Capacity', { min: 1, max: 100_000 })
  const monthlyRate = body.monthlyRate == null ? undefined : num(body.monthlyRate, 'Monthly pass amount', { min: 1, max: 1_000_000 })
  const rateCar = body.rateCar == null ? undefined : num(body.rateCar, 'Car rate', { min: 1, max: 1_000_000 })
  const rateSuv = body.rateSuv == null ? undefined : num(body.rateSuv, 'SUV rate', { min: 1, max: 1_000_000 })
  const rateBike = body.rateBike == null ? undefined : num(body.rateBike, 'Bike rate', { min: 1, max: 1_000_000 })
  const rateEv = body.rateEv == null ? undefined : num(body.rateEv, 'EV rate', { min: 1, max: 1_000_000 })
  const upiId =
    body.upiId === undefined ? undefined : str(body.upiId, 'UPI ID', { optional: true, max: 80 }).toLowerCase()
  if (upiId && !VPA_PATTERN.test(upiId)) {
    fail(400, 'UPI ID looks invalid (example: name@okhdfcbank)')
  }
  const upiName =
    body.upiName === undefined ? undefined : str(body.upiName, 'UPI payee name', { optional: true, max: 60 })
  if (body.remindersEnabled !== undefined && typeof body.remindersEnabled !== 'boolean') {
    fail(400, 'remindersEnabled must be true or false')
  }
  const remindersEnabled = body.remindersEnabled === undefined ? undefined : (body.remindersEnabled as boolean)
  const reminderDays =
    body.reminderDays == null ? undefined : Math.round(num(body.reminderDays, 'Reminder days', { min: 1, max: 14 }))
  const whatsappTemplate =
    body.whatsappTemplate === undefined
      ? undefined
      : str(body.whatsappTemplate, 'WhatsApp template name', { optional: true, max: 120 })
  const whatsappLang =
    body.whatsappLang === undefined
      ? undefined
      : str(body.whatsappLang, 'Template language', { optional: true, max: 10 })
  res.json({
    site: {
      ...updateSite({
        name,
        capacity,
        monthlyRate,
        rateCar,
        rateSuv,
        rateBike,
        rateEv,
        upiId,
        upiName,
        remindersEnabled,
        reminderDays,
        whatsappTemplate,
        whatsappLang,
      }),
      whatsappConfigured,
    },
  })
})

export default router
