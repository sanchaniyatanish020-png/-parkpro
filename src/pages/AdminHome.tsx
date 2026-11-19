import { lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CarFront,
  ChevronRight,
  Clock3,
  IndianRupee,
  MessageCircle,
  Phone,
  Plus,
  ScanLine,
  Ticket,
  UserRoundPlus,
} from 'lucide-react'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { Avatar, Badge, Button, Skeleton } from '@/components/ui'
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
  lastNDays,
} from '@/lib/utils'

const RevenueChart = lazy(() => import('@/components/RevenueChart'))

export default function AdminHome() {
  const { stats, expiring, passes, walkins, ready, refresh } = useData()
  const { t, lang, settings } = useSettings()

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
    <PullToRefresh onRefresh={() => refresh()}>
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

        {stats.occupancyPct >= 90 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-[#991B1B] dark:border-[#DC2626]/30 dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">{t('admin.almostFull')}</p>
              <p className="mt-0.5 text-xs leading-snug">{t('admin.almostFullBody', { n: freeSlots })}</p>
            </div>
          </div>
        )}

        <div className="no-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
          <StatCard
            icon={IndianRupee}
            tone="amber"
            label={t('admin.todayRevenue')}
            value={formatMoney(stats.todayRevenue, lang)}
            sub={t('admin.todayEntries') + ': ' + stats.todayEntries}
            loading={!ready}
          />
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

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <section className="surface p-4 lg:col-span-2 lg:p-5" aria-labelledby="occupancy-title">
            <div className="flex items-center justify-between">
              <h2 id="occupancy-title" className="text-base font-semibold text-navy-900 dark:text-white">
                {t('admin.occupancy')}
              </h2>
              <Link to="/admin/reports" className="text-xs font-bold text-[#1868FE] hover:underline dark:text-blue-400">
                {t('action.viewAll')}
              </Link>
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

          <section className="surface p-4 lg:col-span-3 lg:p-5" aria-labelledby="revenue-title">
            <div className="flex items-center justify-between">
              <h2 id="revenue-title" className="text-base font-semibold text-navy-900 dark:text-white">
                {t('admin.revenue7')}
              </h2>
              <Link to="/admin/reports" className="text-xs font-bold text-[#1868FE] hover:underline dark:text-blue-400">
                {t('admin.fullReport')}
              </Link>
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
        </div>

        <section className="mt-5" aria-labelledby="expiring-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="expiring-title" className="text-lg font-semibold text-navy-900 dark:text-white">
              {t('admin.expiringList')}
            </h2>
            <Link
              to="/admin/passes?filter=expiring"
              className="flex min-h-[40px] items-center gap-0.5 text-xs font-bold text-[#1868FE] dark:text-blue-400"
            >
              {t('action.viewAll')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
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

        <section className="mt-5" aria-labelledby="quick-title">
          <h2 id="quick-title" className="mb-3 text-lg font-semibold text-navy-900 dark:text-white">
            {t('admin.quickActions')}
          </h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <QuickAction to="/admin/passes?new=1" icon={Plus} label={t('admin.newPass')} />
            <QuickAction to="/walk-in" icon={UserRoundPlus} label={t('admin.addWalkin')} />
            <QuickAction to="/scan" icon={ScanLine} label={t('admin.openScanner')} />
            <QuickAction to="/admin/reports" icon={BarChart3} label={t('admin.fullReport')} />
          </div>
        </section>

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

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Plus; label: string }) {
  return (
    <Link
      to={to}
      className="surface flex min-h-[72px] items-center gap-3 p-3.5 rounded-2xl transition-all duration-150 hover:border-blue-400/50 hover:shadow-md active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#1868FE] dark:bg-blue-500/20 dark:text-blue-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-navy-900 dark:text-white">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-navy-300" aria-hidden="true" />
    </Link>
  )
}
