import { Router, type RequestHandler } from 'express'
import { authenticate, requirePermission } from '../auth'
import { env } from '../env'
import { runReminders } from '../reminders'
import { getPass, listReminders, recordReminder } from '../repository'
import { asObject, fail, optionalStr } from '../validate'

const router = Router()

// Express 4 does not forward rejected promises to the error handler.
const asyncHandler =
  (handler: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next)
  }

// External cron hook (Render free instances sleep, so the in-process timer may miss).
router.post(
  '/cron',
  asyncHandler(async (req, res) => {
    if (!env.reminderCronSecret) fail(404, 'Reminder cron is not configured')
    if ((req.get('x-cron-key') ?? '') !== env.reminderCronSecret) fail(401, 'Invalid cron key')
    res.json(await runReminders({ trigger: 'cron', onlyEnabled: true }))
  }),
)

router.use(authenticate)

router.get('/', requirePermission('passes', 'managePasses', 'dashboard'), (_req, res) => {
  res.json({ reminders: listReminders() })
})

router.post(
  '/run',
  requirePermission('siteSettings'),
  asyncHandler(async (_req, res) => {
    res.json(await runReminders({ trigger: 'manual' }))
  }),
)

router.post('/:passId', requirePermission('managePasses'), (req, res) => {
  const pass = getPass(req.params.passId)
  if (!pass) fail(404, 'Pass not found')

  const body = asObject(req.body)
  const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'manual'
  const message = optionalStr(body.message, 'Message', 500) ?? `Renewal reminder for ${pass.name}`
  const reminder = recordReminder({
    passId: pass.id,
    endDate: pass.endDate,
    channel,
    status: 'sent',
    message,
    byName: req.user!.name,
    byUsername: req.user!.username,
  })
  res.status(201).json({ reminder })
})

export default router
