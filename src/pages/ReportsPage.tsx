import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarDays,
  Clock3,
  Download,
  IndianRupee,
  RefreshCw,
  Ticket,
  TrendingUp,
} from 'lucide-react'
import type { VehicleType } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Button, Segmented } from '@/components/ui'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ExportModal, type ExportFormat } from '@/components/ExportModal'
import { exportCsvReport, exportExcelReport, exportPdfReport, type ReportExportData } from '@/lib/export'
import {
  addDays,
  daysLeft,
  formatDateShort,
  formatMoney,
  lastNDays,
  PLAN_PRICE,
  PLANS,
  startOfDay,
} from '@/lib/utils'

type Range = '7' | '30' | '90'

const PLAN_COLORS = ['#1868FE', '#0B1F3A', '#16A34A', '#F97316', '#7C3AED']
const TYPE_ORDER: VehicleType[] = ['car', 'suv', 'bike', 'ev']

export default function ReportsPage() {
  const { passes, walkins, scans, logs, ready, refresh } = useData()
  const { t, lang, dark, settings } = useSettings()
  const { toast } = useToast()
  const [range, setRange] = useState<Range>('30')
  const [exportOpen, setExportOpen] = useState(false)

  const days = Number(range)
  const start = useMemo(() => startOfDay(addDays(new Date(), -(days - 1))), [days])
  const rangeLabel = range === '7' ? t('reports.range7') : range === '30' ? t('reports.range30') : t('reports.range90')

  const passesInRange = useMemo(
    () => passes.filter((pass) => new Date(pass.createdAt).getTime() >= start.getTime()),
    [passes, start],
  )
  const walkinsInRange = useMemo(
    () => walkins.filter((walkin) => new Date(walkin.at).getTime() >= start.getTime()),
    [walkins, start],
  )
  const scansInRange = useMemo(
    () => scans.filter((event) => new Date(event.at).getTime() >= start.getTime()),
    [scans, start],
  )

  const revenue = useMemo(
    () =>
      passesInRange.reduce((sum, pass) => sum + pass.amount, 0) +
      walkinsInRange.reduce((sum, walkin) => sum + walkin.amount, 0),
    [passesInRange, walkinsInRange],
  )
  const avgValue = passesInRange.length ? Math.round(passesInRange.reduce((sum, pass) => sum + pass.amount, 0) / passesInRange.length) : 0
  const renewals = useMemo(
    () =>
      logs.filter(
        (log) => log.kind === 'pass' && log.message.startsWith('Renewed') && new Date(log.at).getTime() >= start.getTime(),
      ).length,
    [logs, start],
  )

  const series = useMemo(() => {
    return lastNDays(days).map((day) => {
      const key = day.toDateString()
      const dayPasses = passesInRange.filter((pass) => new Date(pass.createdAt).toDateString() === key)
      const dayWalkins = walkinsInRange.filter((walkin) => new Date(walkin.at).toDateString() === key)
      const entries =
        scansInRange.filter((event) => event.direction === 'IN' && new Date(event.at).toDateString() === key).length +
        dayWalkins.length
      return {
        label: formatDateShort(day, lang),
        revenue: dayPasses.reduce((sum, pass) => sum + pass.amount, 0) + dayWalkins.reduce((sum, walkin) => sum + walkin.amount, 0),
        entries,
      }
    })
  }, [days, passesInRange, walkinsInRange, scansInRange, lang])

  const hourly = useMemo(() => {
    const bins = Array.from({ length: 24 }, (_, hour) => ({ hour, entries: 0 }))
    for (const event of scansInRange) {
      if (event.direction === 'IN') bins[new Date(event.at).getHours()].entries += 1
    }
    return bins
  }, [scansInRange])

  const peak = useMemo(() => {
    let best = hourly[0]
    for (const bin of hourly) if (bin.entries > best.entries) best = bin
    return best
  }, [hourly])

  const bestDay = useMemo(() => {
    let best = { label: '—', revenue: 0 }
    for (const day of series) if (day.revenue > best.revenue) best = day
    return best
  }, [series])

  const planData = useMemo(() => {
    return PLANS.map((plan, index) => ({
      name: t(`plan_${plan}`),
      value: passesInRange.filter((pass) => pass.plan === plan).reduce((sum, pass) => sum + pass.amount, 0),
      color: PLAN_COLORS[index % PLAN_COLORS.length],
      price: PLAN_PRICE[plan],
    })).filter((entry) => entry.value > 0)
  }, [passesInRange, t])

  const typeData = useMemo(() => {
    const counts: Record<VehicleType, number> = { car: 0, suv: 0, bike: 0, ev: 0 }
    for (const pass of passesInRange) counts[pass.vehicleType] += 1
    for (const walkin of walkinsInRange) counts[walkin.vehicleType] += 1
    const total = Math.max(1, TYPE_ORDER.reduce((sum, type) => sum + counts[type], 0))
    return TYPE_ORDER.map((type) => ({
      type,
      label: t(`vehicle_${type}`),
      count: counts[type],
      pct: Math.round((counts[type] / total) * 100),
    }))
  }, [passesInRange, walkinsInRange, t])

  const renewalsDue = useMemo(
    () => passes.filter((pass) => pass.endDate && daysLeft(pass.endDate) <= 7 && new Date(pass.endDate).getTime() >= Date.now()).length,
    [passes],
  )

  const axisColor = dark ? '#9FB3CE' : '#6B7C93'
  const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(11,31,58,0.08)'
  const tooltipStyle = {
    borderRadius: 12,
    border: 'none',
    background: dark ? '#122A4A' : '#0B1F3A',
    color: '#fff',
    fontSize: 12,
    padding: '6px 10px',
  }

  const handleExport = async (format: ExportFormat) => {
    const filename = `parkpro-report-${range}d`
    const exportData: ReportExportData = {
      siteName: settings.siteName,
      rangeLabel,
      passes: passesInRange,
      walkins: walkinsInRange,
      totalRevenue: revenue,
      totalEntries: passesInRange.length + walkinsInRange.length,
      lang,
    }

    try {
      if (format === 'excel') {
        await exportExcelReport(exportData, filename)
        toast({ message: 'Report downloaded as Excel (.xlsx)', tone: 'success' })
      } else if (format === 'pdf') {
        await exportPdfReport(exportData, filename)
        toast({ message: 'Report downloaded as PDF (.pdf)', tone: 'success' })
      } else {
        exportCsvReport(exportData, filename)
        toast({ message: 'Report downloaded as CSV (.csv)', tone: 'success' })
      }
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    }
  }

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-5xl lg:py-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-navy-500 dark:text-navy-200">{t('reports.subtitle')}</p>
            <p className="mt-1 text-xs font-semibold text-navy-400 dark:text-navy-300">
              {t('reports.passesSold')}: {passesInRange.length} · {t('reports.totalPasses', { n: passes.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            icon={Download}
            onClick={() => setExportOpen(true)}
            disabled={!ready}
            className="min-h-[44px] shrink-0 px-3.5 text-sm"
          >
            {t('reports.export')}
          </Button>
        </div>

        <div className="mt-4">
          <Segmented
            ariaLabel={t('action.filters')}
            value={range}
            onChange={setRange}
            options={[
              { id: '7', label: t('reports.range7') },
              { id: '30', label: t('reports.range30') },
              { id: '90', label: t('reports.range90') },
            ]}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={IndianRupee}
            tone="amber"
            label={t('reports.revenue')}
            value={formatMoney(revenue, lang)}
            sub={t('admin.todayRevenue') + ': ' + formatMoney(series[series.length - 1]?.revenue ?? 0, lang)}
          />
          <Metric icon={Ticket} tone="navy" label={t('reports.passesSold')} value={String(passesInRange.length)} sub={t('passes.subtitle')} />
          <Metric icon={TrendingUp} tone="success" label={t('reports.avgValue')} value={formatMoney(avgValue, lang)} sub={t('passes.plan')} />
          <Metric icon={RefreshCw} tone="warning" label={t('reports.renewals')} value={String(renewals)} sub={rangeLabel} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="surface min-w-0 p-4 lg:col-span-2" aria-labelledby="collections-title">
            <h2 id="collections-title" className="text-base font-semibold text-navy-900 dark:text-white">
              {t('reports.byDay')}
            </h2>
            <div className="mt-2 h-[210px] w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1868FE" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#1868FE" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: axisColor }}
                    minTickGap={22}
                    dy={4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: axisColor }}
                    width={52}
                    tickFormatter={(value) => {
                      const n = Number(value)
                      return n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`
                    }}
                  />
                  <Tooltip
                    cursor={{ stroke: '#1868FE', strokeDasharray: '3 3' }}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#CBD5E1', fontSize: 11, marginBottom: 2 }}
                    formatter={(value) => [formatMoney(Number(value), lang), t('reports.revenue')]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#1868FE" strokeWidth={2.5} fill="url(#reportRevenue)" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {revenue === 0 && <p className="mt-1 text-center text-xs text-navy-400 dark:text-navy-300">{t('reports.noData')}</p>}
          </section>

          <section className="surface min-w-0 p-4" aria-labelledby="hourly-title">
            <h2 id="hourly-title" className="text-base font-semibold text-navy-900 dark:text-white">
              {t('admin.peakHours')}
            </h2>
            <div className="mt-2 h-[180px] w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="hour"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: axisColor }}
                    tickFormatter={(value) => (Number(value) % 6 === 0 ? `${value}:00` : '')}
                    interval={0}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: axisColor }} width={44} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,180,0,0.12)' }}
                    contentStyle={tooltipStyle}
                    labelFormatter={(value) => `${value}:00 – ${Number(value) + 1}:00`}
                    formatter={(value) => [String(value), t('reports.insightPeak')]}
                  />
                  <Bar dataKey="entries" radius={[4, 4, 0, 0]} fill="#FFB400" maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="surface min-w-0 p-4" aria-labelledby="plans-title">
            <h2 id="plans-title" className="text-base font-semibold text-navy-900 dark:text-white">
              {t('reports.byPlan')}
            </h2>
            {planData.length === 0 ? (
              <p className="flex h-[180px] items-center justify-center text-xs text-navy-400 dark:text-navy-300">
                {t('reports.noData')}
              </p>
            ) : (
              <div className="mt-1 flex items-center gap-3">
                <div className="h-[150px] w-[150px] shrink-0" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={68}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {planData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [formatMoney(Number(value), lang), String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {planData.map((entry) => (
                    <li key={entry.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-navy-600 dark:text-navy-100">{entry.name}</span>
                      <span className="shrink-0 font-mono font-semibold text-navy-900 dark:text-white">
                        {formatMoney(entry.value, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Insight
            icon={Clock3}
            label={t('reports.insightPeak')}
            value={t('reports.insightPeakValue', { hour: `${peak.hour}:00`, n: peak.entries })}
          />
          <Insight
            icon={CalendarDays}
            label={t('reports.insightBest')}
            value={t('reports.insightBestValue', { date: bestDay.label, amount: formatMoney(bestDay.revenue, lang) })}
          />
          <Insight icon={RefreshCw} label={t('reports.insightExpiring')} value={t('reports.insightExpiringValue', { n: renewalsDue })} />
        </div>

        <section className="surface mt-4 min-w-0 p-4" aria-labelledby="mix-title">
          <h2 id="mix-title" className="text-base font-semibold text-navy-900 dark:text-white">
            {t('reports.byType')}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {typeData.map((entry) => (
              <li key={entry.type} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-xs font-semibold text-navy-600 dark:text-navy-200">{entry.label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy-100 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-amber-500"
                    style={{ width: `${entry.pct}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-navy-900 dark:text-white">
                  {entry.count} · {entry.pct}%
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-4 text-center text-[11px] leading-snug text-navy-400 dark:text-navy-300">
          {t('settings.notifsHint')}
        </p>

        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title={t('reports.export')}
          subtitle={`${settings.siteName} · ${rangeLabel}`}
          onExport={handleExport}
        />
      </div>
    </PullToRefresh>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Ticket
  label: string
  value: string
  sub: string
  tone: 'amber' | 'navy' | 'success' | 'warning'
}) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    navy: 'bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-white',
    success: 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]',
    warning: 'bg-[#FFEDD5] text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]',
  }
  return (
    <div className="surface p-3.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <p className="mt-2 text-[11px] font-semibold text-navy-500 dark:text-navy-300">{label}</p>
      <p className="mt-0.5 truncate font-mono text-lg font-semibold tabular-nums text-navy-900 dark:text-white">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-navy-400 dark:text-navy-400">{sub}</p>
    </div>
  )
}

function Insight({ icon: Icon, label, value }: { icon: typeof Ticket; label: string; value: string }) {
  return (
    <div className="surface flex items-start gap-3 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-navy-500 dark:text-navy-300">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-navy-900 dark:text-white">{value}</p>
      </div>
    </div>
  )
}
