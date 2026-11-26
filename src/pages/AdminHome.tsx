import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  CalendarClock,
  CalendarOff,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Gauge,
  IndianRupee,
  MessageCircle,
  Phone,
  Plus,
  ScanLine,
  Smartphone,
  Sparkles,
  Ticket,
  TrendingUp,
  UserRound,
  UserRoundPlus,
  X,
} from 'lucide-react'
import { api, ApiError, type PendingLeaveRequest } from '@/lib/api'
import { useAuth } from '@/state/AuthContext'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Badge, Button, Segmented, Skeleton } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { OccupancyMeter } from '@/components/OccupancyMeter'
import { PullToRefresh } from '@/components/PullToRefresh'
import { openWhatsApp, callNumber } from '@/lib/share'
import {
  cn,
  daysLeft,
  formatDate,
  formatDateShort,
  formatMoney,
  formatPlate,
  formatTime,
  lastNDays,
} from '@/lib/utils'

const RevenueChart = lazy(() => import('@/components/RevenueChart'))

export default function AdminHome() {
  const { can } = useAuth()
  const showDashboard = can('dashboard')
  const showRevenue = can('revenue')
  const showEmployees = can('employees')
  const { stats, expiring, passes, walkins, ready, refresh } = useData()
  const { t, lang, settings } = useSettings()
  const { toast } = useToast()
  const [collectionTab, setCollectionTab] = useState<'all' | 'cash' | 'online' | null>(null)
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([])
  const [reviewingLeaveId, setReviewingLeaveId] = useState<string | null>(null)

  const loadPendingLeaves = useCallback(async () => {
    if (!showEmployees) return
    try {
      const res = await api.listStaff()
      setPendingLeaves(res.pendingRequests ?? [])
    } catch {
      /* ignore offline */
    }
  }, [showEmployees])

  useEffect(() => {
    void loadPendingLeaves()
  }, [loadPendingLeaves])

  async function handleReviewLeave(userId: string, leaveId: string, status: 'approved' | 'rejected') {
    setReviewingLeaveId(leaveId)
    try {
      await api.reviewEmployeeLeave(userId, leaveId, status)
      setPendingLeaves((prev) => prev.filter((item) => item.id !== leaveId))
      toast({
        message: status === 'approved' ? 'Leave approved' : 'Leave rejected',
        tone: status === 'approved' ? 'success' : 'info',
      })
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not update leave request',
        tone: 'error',
      })
    } finally {
      setReviewingLeaveId(null)
    }
  }

  const filteredPayments = useMemo(() => {
    if (!collectionTab || collectionTab === 'all') return stats.todayPayments
    if (collectionTab === 'cash') return stats.todayPayments.filter((item) => item.paymentMode === 'cash')
    return stats.todayPayments.filter((item) => item.paymentMode !== 'cash')
  }, [stats.todayPayments, collectionTab])

  const collectorSummary = useMemo(() => {
    const map = new Map<string, { label: string; amount: number; count: number }>()
    for (const item of filteredPayments) {
      const label = item.collectedBy
        ? item.collectedByUsername
          ? `${item.collectedBy} (@${item.collectedByUsername})`
          : item.collectedBy
        : t('admin.unknownCollector')
      const entry = map.get(label)
      if (entry) {
        entry.amount += item.amount
        entry.count += 1
      } else {
        map.set(label, { label, amount: item.amount, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [filteredPayments, t])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('admin.morning') : hour < 17 ? t('admin.afternoon') : t('admin.evening')

  const revenueSeries = useMemo(() => {
    const days = lastNDays(7)
    return days.map((day) => {
      const key = day.toDateString()
      const passRevenue = passes
        .filter((pass) => new Date(pass.createdAt).toDateString() === key)
        .reduce((sum, pass) => sum + pass.amount, 0)
      const walkinRevenue = walkins
        .filter((walkin) => new Date(walkin.at).toDateString() === key)
        .reduce((sum, walkin) => sum + walkin.amount, 0)
      return { day: formatDateShort(day, lang), total: passRevenue + walkinRevenue }
    })
  }, [passes, walkins, lang])

  const occupancyStatus =
    stats.occupancyPct >= 100
      ? t('admin.statusFull')
      : stats.occupancyPct >= 90
        ? t('admin.statusHigh')
        : stats.occupancyPct >= 75
          ? t('admin.statusMid')
          : t('admin.statusLow')

  const freeSlots = Math.max(0, stats.capacity - stats.occupied)

  const remind = (pass: (typeof expiring)[number]) => {
    openWhatsApp(
      pass.phone,
      t('admin.remindText', {
        name: pass.name,
        site: settings.siteName,
        date: formatDate(pass.endDate, lang),
      }),
    )
  }

  return (
    <PullToRefresh
      onRefresh={async () => {
        await Promise.all([refresh(), loadPendingLeaves()])
      }}
    >
      <div className="px-page py-5 lg:mx-auto lg:max-w-5xl lg:py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-navy-500 dark:text-navy-200">
              {greeting}, <span className="font-semibold text-navy-900 dark:text-white">{(settings.ownerName || 'Bhavesh Porva').split(' ')[0]}</span>
            </p>
            <h1 className="mt-0.5 font-display text-[26px] font-bold leading-tight text-navy-900 dark:text-white lg:text-3xl">
              {t('admin.overview')}
            </h1>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 shadow-sm dark:bg-white/10 dark:text-navy-100 sm:inline-flex">
            <CalendarClock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            {settings.siteName}
          </span>
        </div>

        {showDashboard && stats.occupancyPct >= 90 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-[#991B1B] dark:border-[#DC2626]/30 dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">{t('admin.almostFull')}</p>
              <p className="mt-0.5 text-xs leading-snug">{t('admin.almostFullBody', { n: freeSlots })}</p>
            </div>
          </div>
        )}

        {showEmployees && pendingLeaves.length > 0 && (
          <section
            aria-labelledby="home-leave-alerts-title"
            className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-200/80 text-amber-900 dark:bg-amber-500/25 dark:text-amber-200">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="home-leave-alerts-title" className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    {t('emp.pendingRequests')}
                  </h2>
                  <p className="text-xs text-amber-800 dark:text-amber-200/80">
                    {pendingLeaves.length} pending
                  </p>
                </div>
              </div>
              <Link
                to="/admin/employees"
                className="inline-flex items-center gap-1 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-white dark:bg-white/10 dark:text-amber-100"
              >
                {t('nav.employees')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-3 space-y-2">
              {pendingLeaves.map((reqItem) => (
                <li
                  key={reqItem.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 px-3.5 py-2.5 shadow-sm dark:bg-navy-900/80"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-navy-900 dark:text-white">
                          {reqItem.employeeName}
                        </span>
                        <Badge tone={reqItem.leaveType === 'half' ? 'warning' : 'amber'}>
                          {reqItem.leaveType === 'half' ? t('emp.halfDay') : t('emp.fullDay')}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-navy-600 dark:text-navy-300">
                        {reqItem.leaveDate}
                        {reqItem.reason ? ` · ${reqItem.reason}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      icon={Check}
                      disabled={reviewingLeaveId === reqItem.id}
                      onClick={() => void handleReviewLeave(reqItem.userId, reqItem.id, 'approved')}
                      className="min-h-[34px] px-3 py-1 text-xs"
                    >
                      {t('emp.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      icon={X}
                      disabled={reviewingLeaveId === reqItem.id}
                      onClick={() => void handleReviewLeave(reqItem.userId, reqItem.id, 'rejected')}
                      className="min-h-[34px] px-3 py-1 text-xs text-rose-600 dark:text-rose-400"
                    >
                      {t('emp.reject')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showRevenue && (
          <section
            id="today-collection"
            aria-labelledby="today-collection-title"
            className="surface mt-4 p-4 lg:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-[#9A5B00] dark:bg-amber-500/20 dark:text-amber-300">
                  <IndianRupee className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="today-collection-title" className="text-sm font-bold text-navy-900 dark:text-white">
                    {t('admin.todayCollection')}
                  </h2>
                  <p className="text-[11px] text-navy-500 dark:text-navy-300">
                    {t('admin.todayEntries')}: {stats.todayEntries}
                  </p>
                </div>
              </div>
              <Badge tone="amber">
                {t('admin.paymentsCount', { n: stats.todayCashCount + stats.todayOnlineCount })}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setCollectionTab('all')}
                className="group rounded-2xl bg-navy-900 p-3.5 text-left text-white transition-transform hover:scale-[1.01] active:scale-[0.99] dark:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-300">
                    {t('admin.todayTotal')}
                  </p>
                  <ChevronRight className="h-4 w-4 text-navy-300 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                  {ready ? formatMoney(stats.todayRevenue, lang) : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-navy-300">
                  {t('admin.todayEntries')}: {stats.todayEntries} · {t('admin.collectionTapHint')}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCollectionTab('cash')}
                className="group rounded-2xl border border-emerald-200/80 bg-[#ECFDF5] p-3.5 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] dark:border-emerald-500/25 dark:bg-emerald-500/10"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#065F46] dark:text-[#6EE7B7]">
                    {t('admin.todayCash')}
                  </p>
                  <Banknote className="h-4 w-4 text-[#059669] dark:text-[#34D399]" aria-hidden="true" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[#064E3B] dark:text-white">
                  {ready ? formatMoney(stats.todayCashRevenue, lang) : '—'}
                </p>
                <p className="mt-0.5 flex items-center justify-between text-[11px] font-medium text-[#047857] dark:text-[#A7F3D0]">
                  <span>{t('admin.paymentsCount', { n: stats.todayCashCount })}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCollectionTab('online')}
                className="group rounded-2xl border border-blue-200/80 bg-[#EFF6FF] p-3.5 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] dark:border-blue-500/25 dark:bg-blue-500/10"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#1E40AF] dark:text-[#93C5FD]">
                    {t('admin.todayOnline')}
                  </p>
                  <Smartphone className="h-4 w-4 text-[#1868FE] dark:text-[#60A5FA]" aria-hidden="true" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[#1E3A8A] dark:text-white">
                  {ready ? formatMoney(stats.todayOnlineRevenue, lang) : '—'}
                </p>
                <p className="mt-0.5 flex items-center justify-between text-[11px] font-medium text-[#1D4ED8] dark:text-[#BFDBFE]">
                  <span>{t('admin.paymentsCount', { n: stats.todayOnlineCount })}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </p>
              </button>
            </div>
          </section>
        )}

        {/* ── Quick Actions at the top for instant 1-tap entry ── */}
        {showDashboard && (can('walkin') || can('managePasses') || can('scan') || can('reports')) && (
          <section className="mt-4" aria-labelledby="quick-title">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#1868FE]" aria-hidden="true" />
              <h2 id="quick-title" className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
                {t('admin.quickActions')}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {can('walkin') && <QuickAction to="/walk-in" icon={UserRoundPlus} label={t('admin.addWalkin')} sub="Instant parking" color="emerald" />}
              {can('managePasses') && <QuickAction to="/admin/passes?new=1" icon={Plus} label={t('admin.newPass')} sub="Monthly" color="blue" />}
              {can('scan') && <QuickAction to="/scan" icon={ScanLine} label={t('admin.openScanner')} sub="QR gate scanner" color="purple" />}
              {can('reports') && <QuickAction to="/admin/reports" icon={BarChart3} label={t('admin.fullReport')} sub="Revenue & stats" color="amber" />}
            </div>
          </section>
        )}

        {showDashboard && (
          <div className="no-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
            <StatCard
              icon={Ticket}
              tone="navy"
              label={t('admin.activePasses')}
              value={String(stats.activePasses)}
              sub={t('admin.capacity', { n: stats.capacity })}
              loading={!ready}
            />
            <StatCard
              icon={CarFront}
              tone="success"
              label={t('admin.parkedNow')}
              value={String(stats.parked)}
              sub={`${t('admin.occupied')} ${stats.occupied}`}
              loading={!ready}
            />
            <StatCard
              icon={Clock3}
              tone="warning"
              label={t('admin.expiringSoon')}
              value={String(stats.expiring)}
              sub={t('common.days', { n: 3 })}
              loading={!ready}
            />
          </div>
        )}

        {(showDashboard || showRevenue) && (
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            {showDashboard && (
              <section className={cn('surface p-4 lg:p-5', showRevenue ? 'lg:col-span-2' : 'lg:col-span-5')} aria-labelledby="occupancy-title">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-[18px] w-[18px] text-[#1868FE]" aria-hidden="true" />
                    <h2 id="occupancy-title" className="text-base font-semibold text-navy-900 dark:text-white">
                      {t('admin.occupancy')}
                    </h2>
                  </div>
                  {can('reports') && (
                    <Link to="/admin/reports" className="text-xs font-bold text-[#1868FE] hover:underline dark:text-blue-400">
                      {t('action.viewAll')}
                    </Link>
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  <OccupancyMeter
                    percent={stats.occupancyPct}
                    occupied={stats.occupied}
                    capacity={stats.capacity}
                    label={t('admin.occupied')}
                    freeLabel={`${freeSlots} ${t('admin.free').toLowerCase()}`}
                    statusLabel={occupancyStatus}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-navy-50 py-2 dark:bg-white/5">
                    <p className="text-[11px] font-semibold text-navy-500 dark:text-navy-300">{t('admin.parkedNow')}</p>
                    <p className="font-mono text-lg font-semibold text-navy-900 dark:text-white">{stats.parked}</p>
                  </div>
                  <div className="rounded-xl bg-navy-50 py-2 dark:bg-white/5">
                    <p className="text-[11px] font-semibold text-navy-500 dark:text-navy-300">{t('admin.walkinsToday')}</p>
                    <p className="font-mono text-lg font-semibold text-navy-900 dark:text-white">{stats.walkinsToday}</p>
                  </div>
                </div>
              </section>
            )}

            {showRevenue && (
              <section className={cn('surface p-4 lg:p-5', showDashboard ? 'lg:col-span-3' : 'lg:col-span-5')} aria-labelledby="revenue-title">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-[18px] w-[18px] text-emerald-600" aria-hidden="true" />
                    <h2 id="revenue-title" className="text-base font-semibold text-navy-900 dark:text-white">
                      {t('admin.revenue7')}
                    </h2>
                  </div>
                  {can('reports') && (
                    <Link to="/admin/reports" className="text-xs font-bold text-[#1868FE] hover:underline dark:text-blue-400">
                      {t('admin.fullReport')}
                    </Link>
                  )}
                </div>
                <div className="mt-2 h-[170px] w-full" aria-hidden="true">
                  <Suspense fallback={<div className="h-full w-full animate-pulse rounded-2xl bg-navy-50 dark:bg-white/5" />}>
                    <RevenueChart data={revenueSeries} />
                  </Suspense>
                </div>
                <p className="mt-1 text-right font-mono text-xs text-navy-400 dark:text-navy-300">
                  {t('reports.totalPasses', { n: stats.totalPasses })}
                </p>
              </section>
            )}
          </div>
        )}

        {showDashboard && (
          <section className="mt-5" aria-labelledby="expiring-title">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-[18px] w-[18px] text-amber-600" aria-hidden="true" />
                <h2 id="expiring-title" className="text-lg font-semibold text-navy-900 dark:text-white">
                  {t('admin.expiringList')}
                </h2>
              </div>
              {can('passes') && (
                <Link
                  to="/admin/passes?filter=expiring"
                  className="flex min-h-[40px] items-center gap-0.5 text-xs font-bold text-[#1868FE] dark:text-blue-400"
                >
                  {t('action.viewAll')}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>

            {!ready ? (
              <div className="space-y-2.5">
                <Skeleton className="h-[76px] w-full rounded-2xl" />
                <Skeleton className="h-[76px] w-full rounded-2xl" />
              </div>
            ) : expiring.length === 0 ? (
              <div className="surface flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy-900 dark:text-white">{t('admin.expiringEmpty')}</p>
                  <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">{t('admin.expiringEmptyBody')}</p>
                </div>
              </div>
            ) : (
              <ul className="surface divide-y divide-navy-100 overflow-hidden dark:divide-white/10">
                {expiring.slice(0, 5).map((pass) => {
                  const left = daysLeft(pass.endDate)
                  return (
                    <li key={pass.id} className="flex items-center gap-3 p-3.5">
                      <Avatar name={pass.name} photo={pass.photo} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{pass.name}</p>
                          <Badge tone="warning" icon={Clock3} className="shrink-0">
                            {left === 0 ? t('scan.today') : t('scan.daysLeft', { n: left })}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-navy-500 dark:text-navy-200">
                          {formatPlate(pass.vehicle)} · {formatDate(pass.endDate, lang)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => callNumber(pass.phone)}
                          aria-label={`${t('action.call')} ${pass.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700 active:scale-95 dark:bg-white/10 dark:text-white"
                        >
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remind(pass)}
                          aria-label={`${t('action.share')} ${pass.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#15803D] active:scale-95 dark:bg-[#16A34A]/15 dark:text-[#86EFAC]"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {showDashboard && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-navy-900 p-4 text-white dark:bg-white/[0.06]">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t('admin.notifications')}</p>
              <p className="mt-0.5 text-xs text-navy-300">{t('admin.notificationsBody')}</p>
            </div>
            <Link to="/settings#notifications">
              <Button variant="primary" className="min-h-[44px] px-4 text-sm" icon={ArrowRight}>
                {t('action.enable')}
              </Button>
            </Link>
          </div>
        )}
        <Sheet
          open={collectionTab !== null}
          onClose={() => setCollectionTab(null)}
          title={t('admin.todayCollection')}
          subtitle={t('admin.paymentsCount', { n: filteredPayments.length })}
          desktopFullscreen
        >
          <div className="space-y-4">
            <Segmented<'all' | 'cash' | 'online'>
              ariaLabel={t('admin.todayCollection')}
              value={collectionTab ?? 'all'}
              onChange={setCollectionTab}
              options={[
                { id: 'all', label: `${t('admin.allPayments')} (${formatMoney(stats.todayRevenue, lang)})` },
                { id: 'cash', label: `${t('admin.todayCash')} (${formatMoney(stats.todayCashRevenue, lang)})` },
                { id: 'online', label: `${t('admin.todayOnline')} (${formatMoney(stats.todayOnlineRevenue, lang)})` },
              ]}
            />

            {collectorSummary.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {collectorSummary.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-navy-200/70 bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-800 dark:border-white/10 dark:bg-white/10 dark:text-navy-100"
                  >
                    <UserRound className="h-3.5 w-3.5 text-[#1868FE]" aria-hidden="true" />
                    <span>{c.label}:</span>
                    <span className="font-mono font-bold">{formatMoney(c.amount, lang)}</span>
                    <span className="text-navy-400">({c.count})</span>
                  </span>
                ))}
              </div>
            )}

            {filteredPayments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-navy-200 py-8 text-center text-sm text-navy-400 dark:border-white/15 dark:text-navy-300">
                {t('admin.collectionEmpty')}
              </p>
            ) : (
              <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 dark:divide-white/10 dark:border-white/10 lg:grid lg:grid-cols-2 lg:gap-3 lg:divide-y-0 lg:border-0">
                {filteredPayments.map((item) => {
                  const collectorLabel = item.collectedBy
                    ? item.collectedByUsername
                      ? `${item.collectedBy} (@${item.collectedByUsername})`
                      : item.collectedBy
                    : t('admin.unknownCollector')
                  const kindLabel =
                    item.kind === 'walkin'
                      ? t('admin.typeWalkin')
                      : item.kind === 'renewal'
                        ? t('admin.typeRenewal')
                        : t('admin.typeNewPass')
                  const PayIcon = item.paymentMode === 'cash' ? Banknote : item.paymentMode === 'upi' ? Smartphone : CreditCard
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 p-3.5 lg:rounded-2xl lg:border lg:border-navy-100 lg:bg-canvas/50 lg:p-4 lg:dark:border-white/10 lg:dark:bg-white/[0.03]"
                    >
                      <Avatar name={item.customerName} photo={item.photo} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{item.customerName}</p>
                          <Badge tone={item.kind === 'walkin' ? 'amber' : 'neutral'}>{kindLabel}</Badge>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-navy-500 dark:text-navy-300">
                          {item.vehicle ? `${formatPlate(item.vehicle)} · ` : ''}+91 {item.phone} · {formatTime(item.at, lang)}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-navy-600 dark:text-navy-200">
                          <UserRound className="h-3.5 w-3.5 shrink-0 text-[#1868FE]" aria-hidden="true" />
                          <span>{t('admin.collectedBy', { name: collectorLabel })}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-bold text-navy-900 dark:text-white">
                          {formatMoney(item.amount, lang)}
                        </p>
                        <span
                          className={cn(
                            'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                            item.paymentMode === 'cash'
                              ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]'
                              : 'bg-blue-100 text-[#1E40AF] dark:bg-blue-500/20 dark:text-blue-300',
                          )}
                        >
                          <PayIcon className="h-3 w-3" aria-hidden="true" />
                          {t(`pay.${item.paymentMode}`)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Sheet>
      </div>
    </PullToRefresh>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: typeof Ticket
  label: string
  value: string
  sub: string
  tone: 'amber' | 'navy' | 'success' | 'warning'
  loading?: boolean
}) {
  const tones = {
    amber: 'bg-blue-100 text-[#1868FE] dark:bg-blue-500/20 dark:text-blue-300',
    navy: 'bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-white',
    success: 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]',
    warning: 'bg-[#FFEDD5] text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]',
  }
  return (
    <div className="surface flex min-w-[46%] snap-start flex-col gap-1.5 p-4 rounded-2xl transition-all duration-150 hover:border-blue-400/40 hover:shadow-sm lg:min-w-0">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <p className="mt-1 text-[11px] font-semibold text-navy-500 dark:text-navy-300">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className="truncate font-mono text-[22px] font-semibold leading-none tabular-nums text-navy-900 dark:text-white">
          {value}
        </p>
      )}
      <p className="truncate text-[11px] text-navy-400 dark:text-navy-400">{sub}</p>
    </div>
  )
}

function QuickAction({
  to,
  icon: Icon,
  label,
  sub,
  color,
}: {
  to: string
  icon: typeof Plus
  label: string
  sub?: string
  color: 'emerald' | 'blue' | 'purple' | 'amber'
}) {
  const styles = {
    emerald: {
      bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white',
      border: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10',
    },
    blue: {
      bg: 'bg-blue-50 text-[#1868FE] dark:bg-blue-500/20 dark:text-blue-400 group-hover:bg-[#1868FE] group-hover:text-white',
      border: 'hover:border-blue-500/40 hover:shadow-blue-500/10',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white',
      border: 'hover:border-purple-500/40 hover:shadow-purple-500/10',
    },
    amber: {
      bg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white',
      border: 'hover:border-amber-500/40 hover:shadow-amber-500/10',
    },
  }
  const current = styles[color]
  return (
    <Link
      to={to}
      className={cn(
        'group surface flex min-h-[74px] items-center gap-3 p-3.5 rounded-2xl transition-all duration-200 hover:shadow-md active:scale-[0.98]',
        current.border,
      )}
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 shadow-sm', current.bg)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight text-navy-900 dark:text-white group-hover:text-[#1868FE] transition-colors">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-navy-400 dark:text-navy-300 truncate">{sub}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 group-hover:text-[#1868FE] group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
    </Link>
  )
}
