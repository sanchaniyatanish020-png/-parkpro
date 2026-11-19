import { Router } from 'express'
import { authenticate, requireRole } from '../auth'
import { parsePassBody } from '../parsers'
import { deletePass, getPass, listPasses, tokenExists, upsertPass } from '../repository'
import { asObject, fail } from '../validate'

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

router.get('/', (_req, res) => {
  res.json({ passes: listPasses() })
})

router.post('/', requireRole('owner'), (req, res) => {
  const pass = parsePassBody(asObject(req.body))
  if (!pass.token) pass.token = generateToken()
  else if (tokenExists(pass.token)) fail(409, 'Pass code already in use')

  upsertPass(pass)
  res.status(201).json({ pass })
})

router.patch('/:id', requireRole('owner'), (req, res) => {
  const existing = getPass(req.params.id)
  if (!existing) fail(404, 'Pass not found')

  const pass = parsePassBody(asObject(req.body), existing)
  if (pass.token !== existing.token) {
    if (tokenExists(pass.token, existing.id)) fail(409, 'Pass code already in use')
  }
  upsertPass(pass)
  res.json({ pass })
})

router.delete('/:id', requireRole('owner'), (req, res) => {
  if (!deletePass(req.params.id)) fail(404, 'Pass not found')
  res.json({ ok: true })
})

export default router
