import { useCallback, useEffect, useMemo, useState } from 'react'
import { IndianRupee, Plus, Search, Wallet, X } from 'lucide-react'
import { api, type CustomerBalance, type KhataTransaction } from '@/lib/api'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Badge, Button, EmptyState, Segmented, TextInput } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { PullToRefresh } from '@/components/PullToRefresh'
import { formatDateShort, formatMoney, formatPlate, formatTime } from '@/lib/utils'

export default function KhataPage() {
  const { can } = useAuth()
  const canAdjust = can('managePasses') || can('siteSettings')
  const { lang } = useSettings()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<CustomerBalance[]>([])
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [transactions, setTransactions] = useState<KhataTransaction[]>([])
  const [query, setQuery] = useState('')

  const [selected, setSelected] = useState<CustomerBalance | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjPhone, setAdjPhone] = useState('')
  const [adjName, setAdjName] = useState('')
  const [adjVehicle, setAdjVehicle] = useState('')
  const [adjMode, setAdjMode] = useState<'credit' | 'debit'>('credit')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.khataList()
      setBalances(res.balances)
      setTotalOutstanding(res.totalOutstanding)
      setTransactions(res.transactions)
    } catch {
      toast({ message: 'Failed to load advance balances', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return balances
    return balances.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.phone.includes(q) ||
        (b.vehicle && b.vehicle.toLowerCase().includes(q)),
    )
  }, [balances, query])

  const selectedTx = useMemo(() => {
    if (!selected) return []
    return transactions.filter((tx) => tx.phone === selected.phone)
  }, [selected, transactions])

  const openAdjust = (customer?: CustomerBalance) => {
    setAdjPhone(customer?.phone ?? '')
    setAdjName(customer?.name ?? '')
    setAdjVehicle(customer?.vehicle ?? '')
    setAdjMode('credit')
    setAdjAmount('')
    setAdjReason('')
    setAdjustOpen(true)
  }

  const submitAdjust = async () => {
    const amt = Number(adjAmount)
    if (!adjPhone.trim() || !adjName.trim() || !Number.isFinite(amt) || amt <= 0 || !adjReason.trim()) {
      toast({ message: 'Please fill phone, name, amount, and reason', tone: 'error' })
      return
    }
    setSaving(true)
    try {
      await api.khataAdjust({
        phone: adjPhone.trim(),
        customerName: adjName.trim(),
        vehicle: adjVehicle.trim() || undefined,
        mode: adjMode,
        amount: amt,
        reason: adjReason.trim(),
      })
      toast({ message: 'Advance balance updated', tone: 'success' })
      setAdjustOpen(false)
      await load()
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Adjustment failed', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-4xl lg:py-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">
              Customer Advance Khata
            </h1>
            <p className="mt-0.5 text-sm text-navy-500 dark:text-navy-300">
              Total Outstanding Advance:{' '}
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoney(totalOutstanding, lang)}
              </span>
            </p>
          </div>
          {canAdjust && (
            <Button onClick={() => openAdjust()} icon={Plus} className="min-h-[44px] shrink-0 px-3.5 text-sm">
              Add / Adjust
            </Button>
          )}
        </div>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search by name, phone, or vehicle..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field pl-11 pr-11"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-navy-400 hover:bg-navy-50 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          {loading ? (
            <div className="h-32 animate-pulse rounded-2xl bg-navy-50 dark:bg-white/5" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No Customer Advance Balances"
              body="Saved cash change or manual advance credits will appear here."
            />
          ) : (
            filtered.map((item) => (
              <div
                key={item.phone}
                onClick={() => setSelected(item)}
                className="surface flex cursor-pointer items-center gap-3.5 rounded-2xl p-4 transition hover:border-blue-400/50 hover:shadow-md"
              >
                <Avatar name={item.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{item.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-navy-500 dark:text-navy-300">
                    {item.phone}
                    {item.vehicle ? ` · ${formatPlate(item.vehicle)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(item.balance, lang)}
                  </p>
                  <p className="text-[11px] text-navy-400">Tap for history</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.name} · Khata` : 'Khata History'}
        subtitle={selected ? `${selected.phone} · Balance: ${formatMoney(selected.balance, lang)}` : undefined}
        footer={
          canAdjust && selected ? (
            <Button full onClick={() => { const s = selected; setSelected(null); openAdjust(s) }} icon={IndianRupee}>
              Adjust Balance
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-2.5">
          {selectedTx.length === 0 ? (
            <p className="py-6 text-center text-xs text-navy-400">No transactions yet.</p>
          ) : (
            selectedTx.map((tx) => (
              <div
                key={tx.id}
                className="rounded-xl border border-navy-100 bg-navy-50/50 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={tx.amountAdded > 0 ? 'success' : 'warning'}>
                    {tx.amountAdded > 0 ? `+${formatMoney(tx.amountAdded, lang)}` : `-${formatMoney(tx.amountUsed, lang)}`}
                  </Badge>
                  <span className="font-mono text-[11px] text-navy-400">
                    {formatDateShort(tx.at, lang)} · {formatTime(tx.at)}
                  </span>
                </div>
                <p className="mt-1.5 font-medium text-navy-800 dark:text-navy-100">{tx.description}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-navy-500">
                  <span>
                    Prev: {formatMoney(tx.prevBalance, lang)} → New: {formatMoney(tx.newBalance, lang)}
                  </span>
                  {tx.byName && <span>By {tx.byName}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </Sheet>

      <Sheet
        open={adjustOpen}
        onClose={() => (saving ? undefined : setAdjustOpen(false))}
        title="Add / Adjust Advance Balance"
        footer={
          <Button full loading={saving} onClick={() => void submitAdjust()} icon={IndianRupee} className="min-h-[50px]">
            Save Adjustment
          </Button>
        }
      >
        <div className="space-y-3.5">
          <Segmented
            ariaLabel="Adjustment type"
            value={adjMode}
            onChange={setAdjMode}
            options={[
              { id: 'credit', label: 'Add Credit (+)' },
              { id: 'debit', label: 'Deduct (-)' },
            ]}
          />
          <TextInput label="Phone Number" required value={adjPhone} onChange={(e) => setAdjPhone(e.target.value)} />
          <TextInput label="Customer Name" required value={adjName} onChange={(e) => setAdjName(e.target.value)} />
          <TextInput label="Vehicle Number" value={adjVehicle} onChange={(e) => setAdjVehicle(e.target.value)} />
          <TextInput
            label="Amount (₹)"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={adjAmount}
            onChange={(e) => setAdjAmount(e.target.value)}
            icon={IndianRupee}
          />
          <TextInput
            label="Reason"
            required
            value={adjReason}
            onChange={(e) => setAdjReason(e.target.value)}
            placeholder="e.g. Cash change saved / Manual correction"
          />
        </div>
      </Sheet>
    </PullToRefresh>
  )
}
