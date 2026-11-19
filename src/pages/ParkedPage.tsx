import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CarFront,
  ChevronRight,
  CreditCard,
  HandCoins,
  Phone,
  RefreshCw,
  Search,
  Smartphone,
  Timer,
  UserRoundPlus,
  X,
} from 'lucide-react'
import type { ParkedItem, PayMode, PlanId } from '@/types'
import { useData } from '@/state/DataContext'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Button, EmptyState, ListSkeleton, PassStatusBadge, Segmented } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { SwipeableCard } from '@/components/SwipeableCard'
import { PullToRefresh } from '@/components/PullToRefresh'
import { callNumber } from '@/lib/share'
import { vibrate, HAPTIC } from '@/lib/haptics'
import {
  addDays,
  addMonths,
  cn,
  formatDate,
  formatMoney,
  formatPlate,
  formatTime,
  normalizePlate,
  passStatus,
  PLAN_MONTHS,
  PLAN_PRICE,
  PLANS,
} from '@/lib/utils'

export default function ParkedPage() {
  const { parked, walkins, ready, refresh, renewPass } = useData()
  const { role } = useAuth()
  const canManage = role === 'owner'
  const { t, lang, settings } = useSettings()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [renewing, setRenewing] = useState<ParkedItem | null>(null)
  const [plan, setPlan] = useState<PlanId>('monthly')
  const [payment, setPayment] = useState<PayMode>('cash')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return parked
    const plate = normalizePlate(query)
    const digits = query.replace(/\D/g, '')
    return parked.filter(
      ({ pass }) =>
        pass.name.toLowerCase().includes(q) ||
        (plate && pass.vehicle.includes(plate)) ||
        (digits.length >= 3 && pass.phone.includes(digits)),
    )
  }, [parked, query])

  const todayWalkins = useMemo(() => {
    const today = new Date().toDateString()
    return walkins.filter((walkin) => new Date(walkin.at).toDateString() === today)
  }, [walkins])

  const preview = useMemo(() => {
    if (!renewing) return null
    const base = new Date(Math.max(new Date(renewing.pass.endDate).getTime(), Date.now()))
    const end = plan === 'daily' ? addDays(base, 1) : addMonths(base, PLAN_MONTHS[plan])
    return { end, price: PLAN_PRICE[plan] }
  }, [renewing, plan])

  const openRenew = (item: ParkedItem) => {
    setPlan(item.pass.plan === 'daily' ? 'monthly' : item.pass.plan)
    setPayment('cash')
    setRenewing(item)
  }

  const handleCall = (phone: string) => {
    vibrate(HAPTIC.tap, settings.haptics)
    callNumber(phone)
  }

  const handleRenew = async () => {
    if (!renewing) return
    setSaving(true)
    try {
      const updated = await renewPass(renewing.pass, plan, payment)
      vibrate(HAPTIC.success, settings.haptics)
      toast({
        message: t('parked.renewedBody', { name: updated.name, date: formatDate(updated.endDate, lang) }),
        tone: 'success',
      })
      setRenewing(null)
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PullToRefresh onRefresh={() => refresh()} className="min-h-[calc(100dvh-58px)]">
      <div className="px-page py-4 lg:mx-auto lg:max-w-4xl lg:py-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-navy-500 dark:text-navy-200">{t('parked.subtitle')}</p>
            <p className="mt-0.5 font-display text-2xl font-bold text-navy-900 dark:text-white">
              {t('parked.count', { n: parked.length })}
            </p>
          </div>
          <Link
            to="/scan"
            className="btn-primary hidden min-h-[44px] px-4 text-sm sm:inline-flex"
          >
            <CarFront className="h-5 w-5" aria-hidden="true" />
            {t('nav.scan')}
          </Link>
        </div>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label={t('parked.searchPlaceholder')}
            placeholder={t('parked.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field pl-11 pr-11"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('action.clear')}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-navy-400 hover:bg-navy-50 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {parked.length > 0 && canManage && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-navy-400 dark:text-navy-300">
            <HandCoins className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {t('parked.swipe')}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {!ready ? (
            <div className="col-span-full">
              <ListSkeleton rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full">
              {query ? (
                <EmptyState
                  icon={Search}
                  title={t('common.noResults')}
                  body={t('parked.emptyBody')}
                  action={
                    <Button variant="ghost" full onClick={() => setQuery('')}>
                      {t('action.clear')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={CarFront}
                  title={t('parked.emptyTitle')}
                  body={t('parked.emptyBody')}
                  action={
                    <Link to="/scan" className="btn-primary w-full">
                      {t('nav.scan')}
                    </Link>
                  }
                />
              )}
            </div>
          ) : (
            filtered.map((item) => {
              const { pass, since } = item
              const expiring = passStatus(pass) !== 'active'
              return (
                <SwipeableCard
                  key={pass.id}
                  onRenew={canManage ? () => openRenew(item) : undefined}
                  onCall={() => handleCall(pass.phone)}
                  renewLabel={t('action.renew')}
                  callLabel={t('action.call')}
                >
                  <article className="surface p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={pass.name} photo={pass.photo} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-[15px] font-semibold text-navy-900 dark:text-white">
                            {pass.name}
                          </h3>
                          {expiring && <PassStatusBadge pass={pass} />}
                        </div>
                        <p className="mt-0.5 font-mono text-sm font-semibold tracking-wide text-navy-700 dark:text-navy-100">
                          {formatPlate(pass.vehicle)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500 dark:text-navy-300">
                          <span className="inline-flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('parked.since', { time: formatTime(since, lang) })}
                          </span>
                        </div>
                      </div>
                      {canManage && (
                        <Link
                          to={`/admin/passes/${pass.id}`}
                          aria-label={t('passes.detail')}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy-400 hover:bg-navy-50 hover:text-navy-700 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </Link>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCall(pass.phone)}
                        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white text-sm font-semibold text-navy-800 active:scale-[0.99] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {t('action.call')}
                      </button>
                      {canManage && (
                        <Button
                          onClick={() => openRenew(item)}
                          icon={RefreshCw}
                          className="min-h-[48px] flex-1 text-sm"
                        >
                          {t('parked.renew')}
                        </Button>
                      )}
                    </div>
                  </article>
                </SwipeableCard>
              )
            })
          )}
        </div>

        {todayWalkins.length > 0 && (
          <section className="mt-7" aria-labelledby="walkins-today">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="walkins-today" className="text-base font-semibold text-navy-900 dark:text-white">
                {t('admin.walkinsToday')}
              </h2>
              <span className="text-xs font-semibold text-navy-400 dark:text-navy-300">
                {t('reports.totalPasses', { n: todayWalkins.length })}
              </span>
            </div>
            <div className="space-y-2.5">
              {todayWalkins.map((walkin) => (
                <div key={walkin.id} className="surface flex items-center gap-3 p-3.5">
                  <Avatar name={walkin.name} photo={walkin.photo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{walkin.name}</p>
                      <span className="chip shrink-0 border-0 bg-amber-100 py-0.5 text-[10px] text-[#7C4A00] dark:bg-amber-500/15 dark:text-amber-200">
                        <UserRoundPlus className="h-3 w-3" aria-hidden="true" />
                        {t('parked.walkin')}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-navy-600 dark:text-navy-200">
                      {walkin.vehicle ? formatPlate(walkin.vehicle) : walkin.phone} · {formatTime(walkin.at, lang)} ·{' '}
                      {formatMoney(walkin.amount, lang)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCall(walkin.phone)}
                    aria-label={`${t('action.call')} ${walkin.name}`}
                    className="icon-btn border-transparent bg-navy-50 dark:bg-white/10"
                  >
                    <Phone className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Sheet
        open={Boolean(renewing)}
        onClose={() => (saving ? undefined : setRenewing(null))}
        title={t('parked.renewTitle')}
        subtitle={renewing ? t('parked.renewSubtitle', { name: renewing.pass.name }) : undefined}
        footer={
          <Button full loading={saving} onClick={() => void handleRenew()} icon={HandCoins} className="min-h-[52px]">
            {t('action.renew')} · {formatMoney(preview?.price ?? 0, lang)}
          </Button>
        }
      >
        {renewing && preview && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl bg-navy-50 p-3.5 dark:bg-white/5">
              <Avatar name={renewing.pass.name} photo={renewing.pass.photo} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{renewing.pass.name}</p>
                <p className="font-mono text-xs text-navy-500 dark:text-navy-200">
                  {formatPlate(renewing.pass.vehicle)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-navy-400 dark:text-navy-300">{t('passes.planEnds')}</p>
                <p className="font-mono text-sm font-semibold text-navy-900 dark:text-white">
                  {formatDate(preview.end, lang)}
                </p>
              </div>
            </div>

            <div>
              <p className="label">{t('parked.extendBy')}</p>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((option) => {
                  const active = plan === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPlan(option)}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-[62px] flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                          : 'border-navy-100 bg-white hover:border-navy-200 dark:border-white/10 dark:bg-white/5',
                      )}
                    >
                      <span className="text-sm font-semibold text-navy-900 dark:text-white">
                        {t(`plan_${option}`)}
                      </span>
                      <span className="font-mono text-xs text-navy-500 dark:text-navy-300">
                        {formatMoney(PLAN_PRICE[option], lang)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="label">{t('common.amount')}</p>
              <Segmented
                ariaLabel={t('common.amount')}
                value={payment}
                onChange={setPayment}
                options={[
                  { id: 'cash', label: t('pay.cash'), icon: Banknote },
                  { id: 'upi', label: t('pay.upi'), icon: Smartphone },
                  { id: 'card', label: t('pay.card'), icon: CreditCard },
                ]}
              />
            </div>

            <p className="rounded-xl bg-navy-50 px-3 py-2.5 text-xs text-navy-500 dark:bg-white/5 dark:text-navy-200">
              {t('settings.syncHint')}
            </p>
          </div>
        )}
      </Sheet>
    </PullToRefresh>
  )
}
