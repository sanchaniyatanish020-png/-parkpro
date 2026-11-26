import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { authenticate } from '../auth'
import { env } from '../env'
import { subscribe } from '../events'
import { findUserById } from '../repository'

const router = Router()
const TICKET_TTL_SECONDS = 600

/**
 * EventSource cannot send an Authorization header, so the client trades its
 * bearer token for a short-lived stream ticket over a normal authenticated call.
 */
router.post('/ticket', authenticate, (req, res) => {
  const ticket = jwt.sign({ scope: 'events' }, env.jwtSecret, {
    subject: req.user!.id,
    expiresIn: TICKET_TTL_SECONDS,
  })
  res.json({ ticket, expiresIn: TICKET_TTL_SECONDS })
})

router.get('/', (req, res) => {
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : ''
  if (!ticket) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const payload = jwt.verify(ticket, env.jwtSecret)
    if (typeof payload === 'string' || !payload.sub || payload.scope !== 'events') {
      throw new Error('invalid ticket')
    }
    const user = findUserById(String(payload.sub))
    if (!user || !user.active) throw new Error('unknown user')
  } catch {
    res.status(401).json({ error: 'Live updates ticket expired' })
    return
  }
  subscribe(res)
})

export default router
