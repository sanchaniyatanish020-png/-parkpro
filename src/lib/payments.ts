import type { AuditLog, Pass, PayMode, TodayPaymentItem, WalkIn } from '@/types'

export interface PaymentRecord extends TodayPaymentItem {
  vehicleType?: Pass['vehicleType']
}

/**
 * Builds normalized payment records from walk-ins, pass renewals, and initial pass issuances.
 * Deduplicates same-day/same-pass renewal increments from `pass.amount` so totals never double-count.
 */
export function buildPaymentRecords({
  passes,
  walkins,
  logs,
}: {
  passes: Pass[]
  walkins: WalkIn[]
  logs: AuditLog[]
}): PaymentRecord[] {
  const records: PaymentRecord[] = []
  const passById = new Map(passes.map((p) => [p.id, p]))

  for (const walkin of walkins) {
    if (walkin.amount <= 0) continue
    records.push({
      id: walkin.id,
      kind: 'walkin',
      customerName: walkin.name,
      phone: walkin.phone,
      vehicle: walkin.vehicle,
      vehicleType: walkin.vehicleType,
      photo: walkin.photo,
      amount: walkin.amount,
      paymentMode: walkin.paymentMode ?? 'cash',
      at: walkin.at,
      collectedBy: walkin.collectedBy,
      collectedByUsername: walkin.collectedByUsername,
    })
  }

  const renewalTotalByPass = new Map<string, number>()
  for (const log of logs) {
    if (
      log.kind === 'pass' &&
      typeof log.meta?.amount === 'number' &&
      typeof log.meta?.payment === 'string' &&
      typeof log.meta?.passId === 'string' &&
      log.message.startsWith('Renewed ')
    ) {
      const amt = log.meta.amount
      const mode = log.meta.payment as PayMode
      renewalTotalByPass.set(log.meta.passId, (renewalTotalByPass.get(log.meta.passId) ?? 0) + amt)
      const renewedPass = passById.get(log.meta.passId)
      if (amt > 0 && renewedPass) {
        records.push({
          id: `renew_${log.id}`,
          kind: 'renewal',
          customerName: renewedPass.name,
          phone: renewedPass.phone,
          vehicle: renewedPass.vehicle,
          vehicleType: renewedPass.vehicleType,
          photo: renewedPass.photo,
          amount: amt,
          paymentMode: mode,
          at: log.at,
          collectedBy:
            typeof log.meta.collectedBy === 'string' ? log.meta.collectedBy : renewedPass.collectedBy,
          collectedByUsername:
            typeof log.meta.collectedByUsername === 'string'
              ? log.meta.collectedByUsername
              : renewedPass.collectedByUsername,
        })
      }
    }
  }

  for (const pass of passes) {
    const initialAmt = Math.max(0, pass.amount - (renewalTotalByPass.get(pass.id) ?? 0))
    if (initialAmt <= 0) continue
    records.push({
      id: pass.id,
      kind: 'pass',
      customerName: pass.name,
      phone: pass.phone,
      vehicle: pass.vehicle,
      vehicleType: pass.vehicleType,
      photo: pass.photo,
      amount: initialAmt,
      paymentMode: pass.paymentMode ?? 'cash',
      transactionId: pass.transactionId,
      at: pass.createdAt,
      collectedBy: pass.collectedBy,
      collectedByUsername: pass.collectedByUsername,
    })
  }

  return records.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
