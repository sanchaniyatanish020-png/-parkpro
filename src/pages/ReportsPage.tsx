import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  Banknote,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  IndianRupee,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Ticket,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react'
import type { PassStatus, PayMode, PlanId, TodayPaymentItem, VehicleType } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Badge, Button, PassStatusBadge, Segmented, SelectInput } from '@/components/ui'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ExportModal, type ExportFormat } from '@/components/ExportModal'
import { exportCsvReport, exportExcelReport, exportPdfReport, type ReportExportData } from '@/lib/export'
import { buildPaymentRecords } from '@/lib/payments'
import {
  cn,
  daysLeft,
  formatDate,
  formatDateShort,
  formatMoney,
  formatPlate,
  formatTime,
  isoDate,
  normalizePlate,
  passStatus,
  PLAN_PRICE,
  PLANS,
  planLabel,
} from '@/lib/utils'

type ReportType = 'passes' | 'payments'
type DatePreset = 'today' | 'month' | 'all' | 'custom'

const PLAN_COLORS = ['#1868FE', '#0B1F3A', '#16A34A', '#F97316', '#7C3AED']
const TYPE_ORDER: VehicleType[] = ['car', 'suv', 'bike', 'ev']

function monthStartIso(): string {
  const now = new Date()
  return isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
}

function inDateRange(isoOrDate: string, fromDate: string, toDate: string): boolean {
  const time = new Date(isoOrDate).getTime()
  if (Number.isNaN(time)) return false
  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`).getTime()
    if (time < start) return false
  }
  if (toDate) {
    const end = new Date(`${toDate}T23:59:59.999`).getTime()
    if (time > end) return false
  }
  return true
}

export default function ReportsPage() {
  const { passes, walkins, scans, logs, ready, refresh } = useData()
  const { t, lang, dark, settings } = useSettings()
  const { toast } = useToast()

  const todayIso = isoDate(new Date())
  const [reportType, setReportType] = useState<ReportType>('passes')
  const [fromDate, setFromDate] = useState(() => monthStartIso())
  const [toDate, setToDate] = useState(() => todayIso)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)

  const [paymentFilter, setPaymentFilter] = useState<'all' | PayMode>('all')
  const [collectorFilter, setCollectorFilter] = useState<string>('all')
  const [vehicleFilter, setVehicleFilter] = useState<'all' | VehicleType>('all')
  const [planFilter, setPlanFilter] = useState<'all' | PlanId>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PassStatus>('all')
  const [paymentKindFilter, setPaymentKindFilter] = useState<'all' | TodayPaymentItem['kind']>('all')
  const [exportOpen, setExportOpen] = useState(false)

  const activePreset: DatePreset = useMemo(() => {
    if (!fromDate && !toDate) return 'all'
    if (fromDate === todayIso && toDate === todayIso) return 'today'
    if (fromDate === monthStartIso() && toDate === todayIso) return 'month'
    return 'custom'
  }, [fromDate, toDate, todayIso])

  const applyPreset = (preset: 'today' | 'month' | 'all') => {
    if (preset === 'today') {
      setFromDate(todayIso)
      setToDate(todayIso)
    } else if (preset === 'month') {
      setFromDate(monthStartIso())
      setToDate(todayIso)
    } else {
      setFromDate('')
      setToDate('')
    }
  }

  const resetFilters = () => {
    setFromDate(monthStartIso())
    setToDate(todayIso)
    setQuery('')
    setPaymentFilter('all')
    setCollectorFilter('all')
    setVehicleFilter('all')
    setPlanFilter('all')
    setStatusFilter('all')
    setPaymentKindFilter('all')
  }

  const allPayments = useMemo(
    () => buildPaymentRecords({ passes, walkins, logs }),
    [passes, walkins, logs],
  )

  const collectors = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of passes) {
      if (p.collectedBy) {
        const key = p.collectedByUsername || p.collectedBy
        map.set(key, p.collectedByUsername ? `${p.collectedBy} (@${p.collectedByUsername})` : p.collectedBy)
      }
    }
    for (const item of allPayments) {
      if (item.collectedBy) {
        const key = item.collectedByUsername || item.collectedBy
        map.set(key, item.collectedByUsername ? `${item.collectedBy} (@${item.collectedByUsername})` : item.collectedBy)
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [passes, allPayments])

  const qLower = query.trim().toLowerCase()
  const qPlate = normalizePlate(query)
  const qDigits = query.replace(/\D/g, '')

  const matchesCollector = (collectedBy?: string, collectedByUsername?: string) => {
    if (collectorFilter === 'all') return true
    return (collectedByUsername || collectedBy || '') === collectorFilter
  }

  const filteredPasses = useMemo(() => {
    return passes.filter((pass) => {
      if ((fromDate || toDate) && !inDateRange(pass.createdAt, fromDate, toDate)) return false
      if (planFilter !== 'all' && pass.plan !== planFilter) return false
      if (statusFilter !== 'all' && passStatus(pass) !== statusFilter) return false
      if (vehicleFilter !== 'all' && pass.vehicleType !== vehicleFilter) return false
      if (paymentFilter !== 'all' && (pass.paymentMode ?? 'cash') !== paymentFilter) return false
      if (!matchesCollector(pass.collectedBy, pass.collectedByUsername)) return false
      if (qLower) {
        const hit =
          pass.name.toLowerCase().includes(qLower) ||
          (qPlate && pass.vehicle.includes(qPlate)) ||
          (qDigits.length >= 3 && pass.phone.includes(qDigits)) ||
          pass.token.toLowerCase().includes(qLower)
        if (!hit) return false
      }
      return true
    })
  }, [passes, fromDate, toDate, planFilter, statusFilter, vehicleFilter, paymentFilter, collectorFilter, qLower, qPlate, qDigits])

  const filteredWalkins = useMemo(() => {
    return walkins.filter((w) => {
      if ((fromDate || toDate) && !inDateRange(w.at, fromDate, toDate)) return false
      if (vehicleFilter !== 'all' && w.vehicleType !== vehicleFilter) return false
      if (paymentFilter !== 'all' && (w.paymentMode ?? 'cash') !== paymentFilter) return false
      if (!matchesCollector(w.collectedBy, w.collectedByUsername)) return false
      return true
    })
  }, [walkins, fromDate, toDate, vehicleFilter, paymentFilter, collectorFilter])

  const filteredPayments = useMemo(() => {
    return allPayments.filter((item) => {
      if ((fromDate || toDate) && !inDateRange(item.at, fromDate, toDate)) return false
      if (paymentFilter !== 'all' && item.paymentMode !== paymentFilter) return false
      if (paymentKindFilter !== 'all' && item.kind !== paymentKindFilter) return false
      if (vehicleFilter !== 'all' && item.vehicleType && item.vehicleType !== vehicleFilter) return false
      if (!matchesCollector(item.collectedBy, item.collectedByUsername)) return false
      if (qLower) {
        const hit =
          item.customerName.toLowerCase().includes(qLower) ||
          (qPlate && item.vehicle?.includes(qPlate)) ||
          (qDigits.length >= 3 && item.phone.includes(qDigits))
        if (!hit) return false
      }
      return true
    })
  }, [allPayments, fromDate, toDate, paymentFilter, paymentKindFilter, vehicleFilter, collectorFilter, qLower, qPlate, qDigits])

  const scansInRange = useMemo(
    () => scans.filter((event) => (!fromDate && !toDate) || inDateRange(event.at, fromDate, toDate)),
    [scans, fromDate, toDate],
  )

  // Pass report stats
  const passSummary = useMemo(() => {
    let active = 0
    let expiring = 0
    let expired = 0
    let totalAmount = 0
    for (const p of filteredPasses) {
      const s = passStatus(p)
      if (s === 'active') active += 1
      else if (s === 'expiring') expiring += 1
      else expired += 1
      totalAmount += p.amount
    }
    const avg = filteredPasses.length ? Math.round(totalAmount / filteredPasses.length) : 0
    const renewals = logs.filter(
      (log) =>
        log.kind === 'pass' &&
        log.message.startsWith('Renewed ') &&
        ((!fromDate && !toDate) || inDateRange(log.at, fromDate, toDate)),
    ).length
    return { active, expiring, expired, totalAmount, avg, renewals }
  }, [filteredPasses, logs, fromDate, toDate])

  // Payment report stats
  const paymentSummary = useMemo(() => {
    let total = 0
    let cash = 0
    let cashCount = 0
    let online = 0
    let onlineCount = 0
    const byCollector = new Map<string, { label: string; amount: number; count: number }>()

    for (const item of filteredPayments) {
      total += item.amount
      if (item.paymentMode === 'cash') {
        cash += item.amount
        cashCount += 1
      } else {
        online += item.amount
        onlineCount += 1
      }
      const cLabel = item.collectedBy
        ? item.collectedByUsername
          ? `${item.collectedBy} (@${item.collectedByUsername})`
          : item.collectedBy
        : t('admin.unknownCollector')
      const curr = byCollector.get(cLabel)
      if (curr) {
        curr.amount += item.amount
        curr.count += 1
      } else {
        byCollector.set(cLabel, { label: cLabel, amount: item.amount, count: 1 })
      }
    }

    return {
      total,
      cash,
      cashCount,
      online,
      onlineCount,
      collectors: Array.from(byCollector.values()).sort((a, b) => b.amount - a.amount),
    }
  }, [filteredPayments, t])

  // Daily series for Payment Reports chart across whatever dates are filtered
  const paymentSeries = useMemo(() => {
    const byDay = new Map<string, { ts: number; label: string; revenue: number }>()
    for (const item of filteredPayments) {
      const d = new Date(item.at)
      d.setHours(0, 0, 0, 0)
      const key = isoDate(d)
      const existing = byDay.get(key)
      if (existing) {
        existing.revenue += item.amount
      } else {
        byDay.set(key, { ts: d.getTime(), label: formatDateShort(d, lang), revenue: item.amount })
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.ts - b.ts)
  }, [filteredPayments, lang])

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
    for (const day of paymentSeries) if (day.revenue > best.revenue) best = day
    return best
  }, [paymentSeries])

  const planData = useMemo(() => {
    return PLANS.map((plan, index) => ({
      name: t(`plan_${plan}`),
      value: filteredPasses.filter((pass) => pass.plan === plan).reduce((sum, pass) => sum + pass.amount, 0),
      color: PLAN_COLORS[index % PLAN_COLORS.length],
      price: PLAN_PRICE[plan],
    })).filter((entry) => entry.value > 0)
  }, [filteredPasses, t])

  const typeData = useMemo(() => {
    const counts: Record<VehicleType, number> = { car: 0, suv: 0, bike: 0, ev: 0 }
    for (const pass of filteredPasses) counts[pass.vehicleType] += 1
    for (const walkin of filteredWalkins) counts[walkin.vehicleType] += 1
    const total = Math.max(1, TYPE_ORDER.reduce((sum, type) => sum + counts[type], 0))
    return TYPE_ORDER.map((type) => ({
      type,
      label: t(`vehicle_${type}`),
      count: counts[type],
      pct: Math.round((counts[type] / total) * 100),
    }))
  }, [filteredPasses, filteredWalkins, t])

  const renewalsDue = useMemo(
    () => passes.filter((pass) => pass.endDate && daysLeft(pass.endDate) <= 7 && new Date(pass.endDate).getTime() >= Date.now()).length,
    [passes],
  )

  const rangeLabel = useMemo(() => {
    if (!fromDate && !toDate) return t('reports.presetAll')
    if (fromDate && toDate) return fromDate === toDate ? formatDateShort(fromDate, lang) : `${formatDateShort(fromDate, lang)} – ${formatDateShort(toDate, lang)}`
    if (fromDate) return `From ${formatDateShort(fromDate, lang)}`
    return `Until ${formatDateShort(toDate, lang)}`
  }, [fromDate, toDate, lang, t])

  const activeFilterCount =
    (activePreset === 'custom' ? 1 : 0) +
    (query ? 1 : 0) +
    (paymentFilter !== 'all' ? 1 : 0) +
    (collectorFilter !== 'all' ? 1 : 0) +
    (vehicleFilter !== 'all' ? 1 : 0) +
    (reportType === 'passes' && planFilter !== 'all' ? 1 : 0) +
    (reportType === 'passes' && statusFilter !== 'all' ? 1 : 0) +
    (reportType === 'payments' && paymentKindFilter !== 'all' ? 1 : 0)

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
    const filename = `parkpro-${reportType}-report`
    const exportData: ReportExportData = {
      siteName: settings.siteName,
      rangeLabel,
      reportType,
      passes: filteredPasses,
      walkins: filteredWalkins,
      payments: filteredPayments,
      cashTotal: paymentSummary.cash,
      onlineTotal: paymentSummary.online,
      totalRevenue: reportType === 'payments' ? paymentSummary.total : passSummary.totalAmount,
      totalEntries: reportType === 'payments' ? filteredPayments.length : filteredPasses.length,
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

  const matchingCount = reportType === 'passes' ? filteredPasses.length : filteredPayments.length

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-5xl lg:py-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-navy-500 dark:text-navy-200">{t('reports.subtitle')}</p>
            <p className="mt-1 text-xs font-semibold text-navy-400 dark:text-navy-300">
              {t('reports.matchingRecords', { n: matchingCount })} · {rangeLabel}
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

        {/* Report Type Switcher: Pass Reports vs Payment Reports */}
        <div className="mt-4">
          <Segmented<ReportType>
            ariaLabel={t('reports.title')}
            value={reportType}
            onChange={setReportType}
            options={[
              { id: 'passes', label: t('reports.passReports'), icon: Ticket },
              { id: 'payments', label: t('reports.paymentReports'), icon: IndianRupee },
            ]}
          />
        </div>

        {/* Flexible Filter Bar */}
        <section className="surface mt-4 p-4" aria-label={t('action.filters')}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('reports.searchPlaceholder')}
                aria-label={t('reports.searchPlaceholder')}
                className="field min-h-[44px] pl-10 pr-9 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('action.clear')}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['today', 'month', 'all'] as const).map((preset) => {
                const active = activePreset === preset
                const key =
                  preset === 'today' ? 'reports.presetToday' : preset === 'month' ? 'reports.presetMonth' : 'reports.presetAll'
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'min-h-[40px] rounded-xl px-3 text-xs font-bold transition-colors',
                      active
                        ? 'bg-[#1868FE] text-white shadow-sm'
                        : 'bg-navy-50 text-navy-700 hover:bg-navy-100 dark:bg-white/10 dark:text-navy-200',
                    )}
                  >
                    {t(key)}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors',
                  filtersOpen
                    ? 'border-[#1868FE]/40 bg-blue-50 text-[#1868FE] dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-navy-200 text-navy-700 dark:border-white/15 dark:text-navy-200',
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                {t('action.filters')}
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-[#1868FE] px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[#B91C1C] hover:bg-red-50 dark:text-[#FCA5A5] dark:hover:bg-red-500/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('reports.clearFilters')}
                </button>
              )}
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-navy-100 pt-3 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="report-from-date" className="label text-xs">
                  {t('reports.fromDate')}
                </label>
                <input
                  id="report-from-date"
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="field min-h-[44px] text-sm"
                />
              </div>

              <div>
                <label htmlFor="report-to-date" className="label text-xs">
                  {t('reports.toDate')}
                </label>
                <input
                  id="report-to-date"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                  className="field min-h-[44px] text-sm"
                />
              </div>

              <SelectInput
                label={t('reports.filterPayment')}
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value as 'all' | PayMode)}
              >
                <option value="all">{t('action.all')}</option>
                <option value="cash">{t('pay.cash')}</option>
                <option value="upi">{t('pay.upi')}</option>
                <option value="card">{t('pay.card')}</option>
              </SelectInput>

              <SelectInput
                label={t('reports.filterCollector')}
                value={collectorFilter}
                onChange={(event) => setCollectorFilter(event.target.value)}
              >
                <option value="all">{t('action.all')}</option>
                {collectors.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </SelectInput>

              <SelectInput
                label={t('reports.filterVehicle')}
                value={vehicleFilter}
                onChange={(event) => setVehicleFilter(event.target.value as 'all' | VehicleType)}
              >
                <option value="all">{t('action.all')}</option>
                {TYPE_ORDER.map((vt) => (
                  <option key={vt} value={vt}>
                    {t(`vehicle_${vt}`)}
                  </option>
                ))}
              </SelectInput>

              {reportType === 'passes' ? (
                <>
                  <SelectInput
                    label={t('reports.filterPlan')}
                    value={planFilter}
                    onChange={(event) => setPlanFilter(event.target.value as 'all' | PlanId)}
                  >
                    <option value="all">{t('action.all')}</option>
                    {PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {t(`plan_${plan}`)}
                      </option>
                    ))}
                  </SelectInput>

                  <SelectInput
                    label={t('reports.filterStatus')}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | PassStatus)}
                  >
                    <option value="all">{t('action.all')}</option>
                    <option value="active">{t('status.active')}</option>
                    <option value="expiring">{t('status.expiring')}</option>
                    <option value="expired">{t('status.expired')}</option>
                  </SelectInput>
                </>
              ) : (
                <SelectInput
                  label={t('reports.filterType')}
                  value={paymentKindFilter}
                  onChange={(event) => setPaymentKindFilter(event.target.value as 'all' | TodayPaymentItem['kind'])}
                >
                  <option value="all">{t('action.all')}</option>
                  <option value="walkin">{t('admin.typeWalkin')}</option>
                  <option value="pass">{t('admin.typeNewPass')}</option>
                  <option value="renewal">{t('admin.typeRenewal')}</option>
                </SelectInput>
              )}
            </div>
          )}
        </section>

        {reportType === 'passes' ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric
                icon={Ticket}
                tone="navy"
                label={t('reports.passesSold')}
                value={String(filteredPasses.length)}
                sub={`${passSummary.active} ${t('status.active').toLowerCase()} · ${passSummary.expiring} ${t('status.expiring').toLowerCase()}`}
              />
              <Metric
                icon={IndianRupee}
                tone="amber"
                label={t('reports.revenue')}
                value={formatMoney(passSummary.totalAmount, lang)}
                sub={rangeLabel}
              />
              <Metric
                icon={TrendingUp}
                tone="success"
                label={t('reports.avgValue')}
                value={formatMoney(passSummary.avg, lang)}
                sub={t('passes.plan')}
              />
              <Metric
                icon={RefreshCw}
                tone="warning"
                label={t('reports.renewals')}
                value={String(passSummary.renewals)}
                sub={rangeLabel}
              />
            </div>

            <section className="surface mt-4 p-4" aria-labelledby="filtered-passes-title">
              <div className="flex items-center justify-between gap-2">
                <h2 id="filtered-passes-title" className="text-base font-semibold text-navy-900 dark:text-white">
                  {t('reports.passesList')}
                </h2>
                <Badge tone="neutral">{filteredPasses.length}</Badge>
              </div>

              {filteredPasses.length === 0 ? (
                <p className="py-8 text-center text-sm text-navy-400 dark:text-navy-300">{t('reports.noData')}</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-navy-100 dark:border-white/10">
                  <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 bg-navy-50/70 text-[11px] font-semibold uppercase tracking-wider text-navy-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-navy-300">
                        <th className="px-3.5 py-2.5">{t('common.name')}</th>
                        <th className="px-3 py-2.5">{t('passes.vehicle')}</th>
                        <th className="px-3 py-2.5">{t('passes.plan')}</th>
                        <th className="px-3 py-2.5">{t('passes.validity')}</th>
                        <th className="px-3 py-2.5">{t('reports.filterStatus')}</th>
                        <th className="px-3 py-2.5">{t('reports.filterPayment')}</th>
                        <th className="px-3 py-2.5">{t('reports.filterCollector')}</th>
                        <th className="px-3.5 py-2.5 text-right">{t('passes.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100 dark:divide-white/10">
                      {filteredPasses.map((pass) => {
                        const PayIcon = pass.paymentMode === 'upi' ? Smartphone : pass.paymentMode === 'card' ? CreditCard : Banknote
                        return (
                          <tr
                            key={pass.id}
                            className="transition-colors hover:bg-navy-50/70 dark:hover:bg-white/[0.04]"
                          >
                            <td className="px-3.5 py-2.5">
                              <Link to={`/admin/passes/${pass.id}`} className="flex items-center gap-2.5">
                                <Avatar name={pass.name} photo={pass.photo} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-navy-900 dark:text-white">{pass.name}</p>
                                  <p className="font-mono text-[11px] text-navy-500 dark:text-navy-300">+91 {pass.phone}</p>
                                </div>
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-navy-700 dark:text-navy-200">
                              {formatPlate(pass.vehicle)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-navy-700 dark:text-navy-200">
                              {planLabel(pass.plan, t)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-navy-600 dark:text-navy-300">
                              {formatDate(pass.startDate, lang)} – {formatDate(pass.endDate, lang)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <PassStatusBadge pass={pass} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-semibold text-navy-700 dark:bg-white/10 dark:text-navy-200">
                                <PayIcon className="h-3 w-3" aria-hidden="true" />
                                {t(`pay.${pass.paymentMode ?? 'cash'}`)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-navy-600 dark:text-navy-300">
                              {pass.collectedBy ? (
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="h-3.5 w-3.5 text-[#1868FE]" aria-hidden="true" />
                                  {pass.collectedBy}
                                </span>
                              ) : (
                                <span className="text-navy-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                              <Link
                                to={`/admin/passes/${pass.id}`}
                                className="inline-flex items-center gap-1 font-mono font-bold text-navy-900 dark:text-white"
                              >
                                {formatMoney(pass.amount, lang)}
                                <ChevronRight className="h-4 w-4 text-navy-300" aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="surface min-w-0 p-4" aria-labelledby="hourly-title">
                <h2 id="hourly-title" className="text-base font-semibold text-navy-900 dark:text-white">
                  {t('admin.peakHours')}
                </h2>
                <div className="mt-2 h-[180px] w-full" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
          </>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric
                icon={IndianRupee}
                tone="amber"
                label={t('reports.revenue')}
                value={formatMoney(paymentSummary.total, lang)}
                sub={rangeLabel}
              />
              <Metric
                icon={Banknote}
                tone="success"
                label={t('admin.todayCash')}
                value={formatMoney(paymentSummary.cash, lang)}
                sub={t('admin.paymentsCount', { n: paymentSummary.cashCount })}
              />
              <Metric
                icon={Smartphone}
                tone="navy"
                label={t('admin.todayOnline')}
                value={formatMoney(paymentSummary.online, lang)}
                sub={t('admin.paymentsCount', { n: paymentSummary.onlineCount })}
              />
              <Metric
                icon={TrendingUp}
                tone="warning"
                label={t('reports.transactions')}
                value={String(filteredPayments.length)}
                sub={rangeLabel}
              />
            </div>

            {paymentSummary.collectors.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {paymentSummary.collectors.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-navy-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-navy-100"
                  >
                    <UserRound className="h-3.5 w-3.5 text-[#1868FE]" aria-hidden="true" />
                    <span>{c.label}:</span>
                    <span className="font-mono font-bold">{formatMoney(c.amount, lang)}</span>
                    <span className="text-navy-400">({c.count})</span>
                  </span>
                ))}
              </div>
            )}

            <section className="surface mt-4 min-w-0 p-4" aria-labelledby="collections-title">
              <h2 id="collections-title" className="text-base font-semibold text-navy-900 dark:text-white">
                {t('reports.byDay')}
              </h2>
              <div className="mt-2 h-[210px] w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={paymentSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
              {paymentSummary.total === 0 && <p className="mt-1 text-center text-xs text-navy-400 dark:text-navy-300">{t('reports.noData')}</p>}
            </section>

            <section className="surface mt-4 p-4" aria-labelledby="filtered-payments-title">
              <div className="flex items-center justify-between gap-2">
                <h2 id="filtered-payments-title" className="text-base font-semibold text-navy-900 dark:text-white">
                  {t('reports.paymentsList')}
                </h2>
                <Badge tone="neutral">{filteredPayments.length}</Badge>
              </div>

              {filteredPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-navy-400 dark:text-navy-300">{t('reports.noData')}</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-navy-100 dark:border-white/10">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 bg-navy-50/70 text-[11px] font-semibold uppercase tracking-wider text-navy-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-navy-300">
                        <th className="px-3.5 py-2.5">{t('common.name')}</th>
                        <th className="px-3 py-2.5">{t('passes.vehicle')}</th>
                        <th className="px-3 py-2.5">{t('reports.filterType')}</th>
                        <th className="px-3 py-2.5">{t('common.date')}</th>
                        <th className="px-3 py-2.5">{t('common.time')}</th>
                        <th className="px-3 py-2.5">{t('reports.filterPayment')}</th>
                        <th className="px-3 py-2.5">{t('reports.filterCollector')}</th>
                        <th className="px-3.5 py-2.5 text-right">{t('passes.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100 dark:divide-white/10">
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
                          <tr
                            key={item.id}
                            className="transition-colors hover:bg-navy-50/70 dark:hover:bg-white/[0.04]"
                          >
                            <td className="px-3.5 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={item.customerName} photo={item.photo} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-navy-900 dark:text-white">{item.customerName}</p>
                                  <p className="font-mono text-[11px] text-navy-500 dark:text-navy-300">+91 {item.phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-navy-700 dark:text-navy-200">
                              {item.vehicle ? formatPlate(item.vehicle) : '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <Badge tone={item.kind === 'walkin' ? 'amber' : 'neutral'}>{kindLabel}</Badge>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-navy-600 dark:text-navy-300">
                              {formatDateShort(item.at, lang)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-navy-600 dark:text-navy-300">
                              {formatTime(item.at, lang)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                                  item.paymentMode === 'cash'
                                    ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]'
                                    : 'bg-blue-100 text-[#1E40AF] dark:bg-blue-500/20 dark:text-blue-300',
                                )}
                              >
                                <PayIcon className="h-3 w-3" aria-hidden="true" />
                                {t(`pay.${item.paymentMode}`)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-navy-600 dark:text-navy-200">
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5 shrink-0 text-[#1868FE]" aria-hidden="true" />
                                {collectorLabel}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-navy-900 dark:text-white">
                              {formatMoney(item.amount, lang)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title={t('reports.export')}
          subtitle={`${settings.siteName} · ${reportType === 'passes' ? t('reports.passReports') : t('reports.paymentReports')} · ${rangeLabel}`}
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
    <div className="surface rounded-2xl p-4 transition-all hover:border-blue-400/40 hover:shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-2 text-[11px] font-semibold text-navy-500 dark:text-navy-300">{label}</p>
      <p className="mt-0.5 truncate font-mono text-lg font-bold tabular-nums text-navy-900 dark:text-white">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-navy-400 dark:text-navy-400">{sub}</p>
    </div>
  )
}

function Insight({ icon: Icon, label, value }: { icon: typeof Ticket; label: string; value: string }) {
  return (
    <div className="surface flex items-start gap-3 rounded-2xl p-4 transition-all hover:border-blue-400/40 hover:shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-[#1868FE] shadow-sm dark:bg-blue-500/20 dark:text-blue-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-navy-500 dark:text-navy-300">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-navy-900 dark:text-white">{value}</p>
      </div>
    </div>
  )
}
