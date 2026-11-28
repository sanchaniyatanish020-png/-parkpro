import { Router } from 'express'
import { authenticate, requirePermission } from '../auth'
import {
  applyKhataTransaction,
  getCustomerBalance,
  listCustomerBalances,
  listKhataTransactions,
} from '../repository'
import { asObject, fail, num, optionalStr, str } from '../validate'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('passes', 'managePasses', 'reports', 'siteSettings'), (_req, res) => {
  const balances = listCustomerBalances()
  const totalOutstanding = Math.round(balances.reduce((sum, b) => sum + b.balance, 0) * 100) / 100
  const transactions = listKhataTransactions(undefined, 200)
  res.json({ balances, totalOutstanding, transactions })
})

router.get('/:phone', requirePermission('passes', 'managePasses', 'scan'), (req, res) => {
  const clean = req.params.phone.replace(/\D/g, '').slice(-10)
  if (clean.length < 10) {
    res.json({ balance: null, transactions: [] })
    return
  }
  const balance = getCustomerBalance(clean)
  const transactions = listKhataTransactions(clean, 100)
  res.json({ balance, transactions })
})

router.post('/adjust', requirePermission('managePasses', 'siteSettings'), (req, res) => {
  const body = asObject(req.body)
  const phone = str(body.phone, 'Phone number', { min: 10, max: 20 })
  const customerName = str(body.customerName, 'Customer name', { min: 1, max: 80 })
  const vehicle = optionalStr(body.vehicle, 'Vehicle', 20)
  const mode = body.mode === 'debit' ? 'debit' : 'credit'
  const amount = num(body.amount, 'Amount', { min: 1, max: 100_000 })
  const reason = str(body.reason, 'Reason', { min: 2, max: 200 })

  try {
    const result = applyKhataTransaction({
      phone,
      customerName,
      vehicle,
      type: 'adjustment',
      amountAdded: mode === 'credit' ? amount : 0,
      amountUsed: mode === 'debit' ? amount : 0,
      description: reason,
      byName: req.user!.name,
      byUsername: req.user!.username,
    })
    res.json(result)
  } catch (err) {
    fail(400, err instanceof Error ? err.message : 'Balance adjustment failed')
  }
})

export default router
