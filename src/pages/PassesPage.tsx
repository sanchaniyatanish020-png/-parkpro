import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  BellRing,
  Bike,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  IndianRupee,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Search,
  Smartphone,
  Ticket,
  Truck,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Pass, PassStatus, PayMode, PlanId, VehicleType } from '@/types'
import { useAuth } from '@/state/AuthContext'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ListSkeleton,
  PassStatusBadge,
  PlateInput,
  PhoneInput,
  Segmented,
  TextareaInput,
  TextInput,
} from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { UpiPaySheet } from '@/components/UpiPaySheet'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ExportModal, type ExportFormat } from '@/components/ExportModal'
import { exportPassesList } from '@/lib/export'
import { callNumber, openWhatsApp } from '@/lib/share'
import {
  daysLeft,
  formatDate,
  formatMoney,
  formatPlate,
  isoDate,
  normalizePlate,
  passStatus,
  planEndDate,
  planLabel,
  proratedMonthlyPrice,
  validPhone,
} from '@/lib/utils'

type Filter = 'all' | PassStatus

const VEHICLE_OPTIONS: { id: VehicleType; label: string }[] = [
  { id: 'car', label: 'vehicle_car' },
  { id: 'suv', label: 'vehicle_suv' },
  { id: 'bike', label: 'vehicle_bike' },
  { id: 'ev', label: 'vehicle_ev' },
]

const VEHICLE_ICONS: Record<VehicleType, typeof Car> = {
  car: Car,
  suv: Truck,
  bike: Bike,
  ev: Zap,
}

export default function PassesPage() {
  const { can } = useAuth()
  const canManagePasses = can('managePasses')
  const canExportReports = can('reports')
  const canEditRate = can('siteSettings') || can('managePasses')
  const { passes, ready, createPass, refresh, updateSite, reminders, markReminder } = useData()
  const { t, lang, settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const rateForVehicle = (vt: VehicleType): number => {
    if (vt === 'suv') return settings.rateSuv ?? 1800
    if (vt === 'bike') return settings.rateBike ?? 1200
    if (vt === 'ev') return settings.rateEv ?? 1800
    return settings.rateCar ?? settings.monthlyRate ?? 1800
  }

  const [rateOpen, setRateOpen] = useState(false)
  const [rateCarDraft, setRateCarDraft] = useState(String(settings.rateCar ?? 1800))
  const [rateSuvDraft, setRateSuvDraft] = useState(String(settings.rateSuv ?? 1800))
  const [rateBikeDraft, setRateBikeDraft] = useState(String(settings.rateBike ?? 1200))
  const [rateEvDraft, setRateEvDraft] = useState(String(settings.rateEv ?? 1800))
  const [savingRate, setSavingRate] = useState(false)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>(() => {
    const value = params.get('filter')
    return value === 'active' || value === 'expiring' || value === 'expired' ? value : 'all'
  })
  const [formOpen, setFormOpen] = useState(() => canManagePasses && params.get('new') === '1')
  const [upiOpen, setUpiOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [remindersOpen, setRemindersOpen] = useState(false)

  const today = isoDate(new Date())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('car')
  const [plan, setPlan] = useState<PlanId>('monthly')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(isoDate(new Date(planEndDate('monthly', today))))
  const [amount, setAmount] = useState(proratedMonthlyPrice(today, settings.monthlyRate))
  const [paymentMode, setPaymentMode] = useState<PayMode>('cash')
  const [availableAdvance, setAvailableAdvance] = useState(0)
  const [useAdvance, setUseAdvance] = useState(false)
  const [advanceToUse, setAdvanceToUse] = useState(0)
  const [cashReceived, setCashReceived] = useState('')
  const [saveChangeAsAdvance, setSaveChangeAsAdvance] = useState(true)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; vehicle?: string; dates?: string }>({})
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1') {
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
    // Clear the one-shot deep-link parameter on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => {
    const result = { active: 0, expiring: 0, expired: 0 }
    for (const pass of passes) result[passStatus(pass)] += 1
    return result
  }, [passes])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const plate = normalizePlate(query)
    const digits = query.replace(/\D/g, '')
    return passes
      .filter((pass) => filter === 'all' || passStatus(pass) === filter)
      .filter(
        (pass) =>
          !q ||
          pass.name.toLowerCase().includes(q) ||
          (plate && pass.vehicle.includes(plate)) ||
          (digits.length >= 3 && pass.phone.includes(digits)) ||
          pass.token.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
  }, [passes, filter, query])

  const reminderDays = settings.reminderDays || 3
  const dueReminders = useMemo(
    () =>
      passes
        .filter((pass) => passStatus(pass) !== 'expired' && daysLeft(pass.endDate) <= reminderDays)
        .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()),
    [passes, reminderDays],
  )
  const remindedKeys = useMemo(
    () =>
      new Set(
        reminders
          .filter((reminder) => reminder.status === 'sent')
          .map((reminder) => `${reminder.passId}|${reminder.endDate}`),
      ),
    [reminders],
  )

  const sendReminder = (pass: Pass) => {
    const message = t('admin.remindText', {
      name: pass.name,
      site: settings.siteName,
      date: formatDate(pass.endDate, lang),
    })
    openWhatsApp(pass.phone, message)
    void markReminder(pass.id, message)
  }

  const openCreate = () => {
    const start = isoDate(new Date())
    setName('')
    setPhone('')
    setVehicle('')
    setVehicleType('car')
    setPlan('monthly')
    setStartDate(start)
    setEndDate(isoDate(new Date(planEndDate('monthly', start))))
    setAmount(proratedMonthlyPrice(start, rateForVehicle('car')))
    setPaymentMode('cash')
    setNotes('')
    setErrors({})
    setFormOpen(true)
  }

  const changeStart = (next: string) => {
    setStartDate(next)
    if (next) {
      setEndDate(isoDate(new Date(planEndDate(plan, next))))
      setAmount(proratedMonthlyPrice(next, rateForVehicle(vehicleType)))
    }
  }

  const openRateEditor = () => {
    setRateCarDraft(String(settings.rateCar ?? 1800))
    setRateSuvDraft(String(settings.rateSuv ?? 1800))
    setRateBikeDraft(String(settings.rateBike ?? 1200))
    setRateEvDraft(String(settings.rateEv ?? 1800))
    setRateOpen(true)
  }

  const saveRate = async () => {
    const rateCar = Math.round(Number(rateCarDraft))
    const rateSuv = Math.round(Number(rateSuvDraft))
    const rateBike = Math.round(Number(rateBikeDraft))
    const rateEv = Math.round(Number(rateEvDraft))
    if (
      !Number.isFinite(rateCar) || rateCar < 1 ||
      !Number.isFinite(rateSuv) || rateSuv < 1 ||
      !Number.isFinite(rateBike) || rateBike < 1 ||
      !Number.isFinite(rateEv) || rateEv < 1
    ) {
      toast({ message: t('passes.rateInvalid'), tone: 'error' })
      return
    }
    setSavingRate(true)
    const ok = await updateSite({ monthlyRate: rateCar, rateCar, rateSuv, rateBike, rateEv })
    setSavingRate(false)
    if (!ok) return
    if (formOpen) {
      const nextRate = vehicleType === 'suv' ? rateSuv : vehicleType === 'bike' ? rateBike : vehicleType === 'ev' ? rateEv : rateCar
      setAmount(proratedMonthlyPrice(startDate, nextRate))
    }
    setRateOpen(false)
    toast({ message: 'Monthly pass rates updated', tone: 'success' })
  }

  const validateForm = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = t('walkin.requiredName')
    if (!validPhone(phone)) {
      next.phone = t('walkin.requiredPhone')
    } else {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10)
      const dupPhone = passes.find((p) => daysLeft(p.endDate) >= 0 && p.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
      if (dupPhone) next.phone = `Active pass already exists for this phone (${dupPhone.token})`
    }
    const cleanPlate = normalizePlate(vehicle)
    if (cleanPlate.length < 6) {
      next.vehicle = t('passes.invalidPlate')
    } else {
      const dupVehicle = passes.find((p) => daysLeft(p.endDate) >= 0 && normalizePlate(p.vehicle) === cleanPlate)
      if (dupVehicle) next.vehicle = `Active pass already exists for ${formatPlate(cleanPlate)} (${dupVehicle.token})`
    }
    if (!startDate || !endDate || new Date(endDate).getTime() < new Date(startDate).getTime()) {
      next.dates = t('passes.invalidDates')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  useEffect(() => {
    if (!formOpen) return
    const clean = phone.replace(/\D/g, '').slice(-10)
    if (clean.length < 10) {
      setAvailableAdvance(0)
      setUseAdvance(false)
      setAdvanceToUse(0)
      return
    }
    let active = true
    void api
      .khataByPhone(clean)
      .then((res) => {
        if (!active) return
        const bal = res.balance?.balance ?? 0
        setAvailableAdvance(bal)
        if (bal > 0) {
          setUseAdvance(true)
          setAdvanceToUse(Math.min(bal, amount))
        } else {
          setUseAdvance(false)
          setAdvanceToUse(0)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [formOpen, phone, amount])

  const effectiveAdvanceUsed = useAdvance ? Math.min(availableAdvance, Math.max(0, advanceToUse), amount) : 0
  const remainingPayable = Math.max(0, amount - effectiveAdvanceUsed)
  const cashChange =
    paymentMode === 'cash' && remainingPayable > 0 && Number(cashReceived) > remainingPayable
      ? Math.round((Number(cashReceived) - remainingPayable) * 100) / 100
      : 0
  const effectiveAdvanceSaved = cashChange > 0 && saveChangeAsAdvance ? cashChange : 0

  const submitCreate = async (transactionId?: string): Promise<boolean> => {
    setCreating(true)
    try {
      const pass = await createPass({
        name,
        phone,
        vehicle,
        vehicleType,
        plan,
        startDate,
        endDate,
        amount,
        paymentMode,
        transactionId,
        advanceUsed: effectiveAdvanceUsed,
        advanceSaved: effectiveAdvanceSaved,
        notes,
      })
      toast({
        message: t('passes.createdBody', { name: pass.name, date: formatDate(pass.endDate, lang) }),
        tone: 'success',
      })
      setUpiOpen(false)
      setFormOpen(false)
      navigate(`/admin/passes/${pass.id}`)
      return true
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : t('toast.error'), tone: 'error' })
      return false
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = () => {
    if (!validateForm()) return
    if (paymentMode === 'upi' && remainingPayable > 0) {
      setFormOpen(false)
      setUpiOpen(true)
      return
    }
    void submitCreate()
  }

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportPassesList(list, settings.siteName, format)
      const formatLabel = format === 'excel' ? 'Excel (.xlsx)' : format === 'pdf' ? 'PDF (.pdf)' : 'CSV (.csv)'
      toast({ message: `Passes downloaded as ${formatLabel}`, tone: 'success' })
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    }
  }

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-4xl lg:py-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-navy-500 dark:text-navy-200">{t('passes.subtitle')}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
              <span className="text-[#15803D] dark:text-[#86EFAC]">{t('passes.activeCount', { n: counts.active })}</span>
              <span className="text-navy-200 dark:text-white/20" aria-hidden="true">·</span>
              <span className="text-[#9A3412] dark:text-[#FDBA74]">{t('passes.expiringCount', { n: counts.expiring })}</span>
              <span className="text-navy-200 dark:text-white/20" aria-hidden="true">·</span>
              <span className="text-[#991B1B] dark:text-[#FCA5A5]">{t('passes.expiredCount', { n: counts.expired })}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExportReports && (
              <Button
                variant="ghost"
                icon={Download}
                onClick={() => setExportOpen(true)}
                disabled={!ready || list.length === 0}
                className="min-h-[44px] shrink-0 px-3.5 text-sm"
              >
                {t('reports.export')}
              </Button>
            )}
            {canManagePasses && (
              <Button onClick={openCreate} icon={Plus} className="min-h-[44px] shrink-0 px-3.5 text-sm">
                {t('passes.new')}
              </Button>
            )}
          </div>
        </div>

        <section
          aria-label={t('passes.rateTitle')}
          className="mesh-navy relative mt-4 overflow-hidden rounded-2xl p-4 text-white shadow-soft"
        >
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-blue-500/25 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-14 left-8 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <IndianRupee className="h-6 w-6 text-amber-300" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-200">{t('passes.rateTitle')}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-white">
                <span>{t('vehicle_car')}: <span className="font-mono text-amber-300">{formatMoney(settings.rateCar ?? 1800, lang)}</span></span>
                <span>{t('vehicle_suv')}: <span className="font-mono text-amber-300">{formatMoney(settings.rateSuv ?? 1800, lang)}</span></span>
                <span>{t('vehicle_bike')}: <span className="font-mono text-amber-300">{formatMoney(settings.rateBike ?? 1200, lang)}</span></span>
                <span>{t('vehicle_ev')}: <span className="font-mono text-amber-300">{formatMoney(settings.rateEv ?? 1800, lang)}</span></span>
              </div>
            </div>
            {canEditRate ? (
              <button
                type="button"
                onClick={openRateEditor}
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 active:scale-95"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {t('passes.rateEdit')}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-navy-200">
                {t('passes.rateLockedShort')}
              </span>
            )}
          </div>
        </section>

        <section aria-label={t('reminders.cardTitle')} className="surface mt-3 overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3.5 p-4">
            <span
              className={
                settings.remindersEnabled && settings.whatsappConfigured
                  ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]'
                  : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300'
              }
            >
              <BellRing className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-navy-900 dark:text-white">{t('reminders.cardTitle')}</p>
                <Badge
                  tone={
                    settings.remindersEnabled && settings.whatsappConfigured
                      ? 'success'
                      : settings.remindersEnabled
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {settings.remindersEnabled && settings.whatsappConfigured
                    ? t('reminders.autoOn')
                    : settings.remindersEnabled
                      ? t('reminders.autoPending')
                      : t('reminders.manualOnly')}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">
                {dueReminders.length > 0
                  ? t('reminders.cardDue', { n: dueReminders.length })
                  : t('reminders.cardEmpty', { days: reminderDays })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRemindersOpen(true)}
              disabled={dueReminders.length === 0}
              className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-navy-50 px-3 text-xs font-bold text-navy-800 transition hover:bg-navy-100 active:scale-95 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              {t('reminders.open')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label={t('passes.search')}
            placeholder={t('passes.search')}
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

        <div className="mt-3">
          <Segmented
            ariaLabel={t('action.filters')}
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: t('action.all') },
              { id: 'active', label: t('status.active') },
              { id: 'expiring', label: t('status.expiring') },
              { id: 'expired', label: t('status.expired') },
            ]}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {!ready ? (
            <div className="col-span-full">
              <ListSkeleton rows={6} />
            </div>
          ) : list.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={query ? Search : Ticket}
                title={query ? t('common.noResults') : t('passes.title')}
                body={query ? t('passes.search') : t('passes.subtitle')}
                action={
                  query ? (
                    <Button variant="ghost" full onClick={() => setQuery('')}>
                      {t('action.clear')}
                    </Button>
                  ) : (
                    <Button full onClick={openCreate} icon={Plus}>
                      {t('passes.new')}
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            list.map((pass) => {
              const VIcon = VEHICLE_ICONS[pass.vehicleType] ?? Car
              return (
                <Link
                  key={pass.id}
                  to={`/admin/passes/${pass.id}`}
                  className="surface flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-150 hover:border-blue-400/50 hover:shadow-md active:scale-[0.995]"
                >
                  <Avatar name={pass.name} photo={pass.photo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{pass.name}</p>
                      <PassStatusBadge pass={pass} />
                    </div>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 truncate font-mono text-xs font-semibold text-navy-600 dark:text-navy-200">
                      <VIcon className="h-3.5 w-3.5 text-navy-400 dark:text-navy-300" aria-hidden="true" />
                      <span>{formatPlate(pass.vehicle)}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-navy-400 dark:text-navy-300">
                      {t('scan.validTill', { date: formatDate(pass.endDate, lang) })} · {planLabel(pass.plan, t)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-navy-900 dark:text-white">
                      {formatMoney(pass.amount, lang)}
                    </p>
                    <ChevronRight className="ml-auto mt-1.5 h-4 w-4 text-navy-300" aria-hidden="true" />
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      <Sheet
        open={formOpen}
        onClose={() => (creating ? undefined : setFormOpen(false))}
        title={t('passes.newTitle')}
        subtitle={t('passes.newSubtitle')}
        footer={
          <Button full loading={creating} onClick={handleCreate} icon={paymentMode === 'upi' && remainingPayable > 0 ? QrCode : Ticket} className="min-h-[52px]">
            {paymentMode === 'upi' && remainingPayable > 0 ? t('upi.showQr') : t('passes.create')}
          </Button>
        }
      >
        <div className="space-y-4">
          <TextInput
            label={t('passes.name')}
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            placeholder={t('passes.namePlaceholder')}
            autoComplete="name"
            autoCapitalize="words"
            error={errors.name}
            icon={UserRound}
          />

          <PhoneInput
            label={t('passes.phone')}
            required
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
            }}
            error={errors.phone}
          />

          <PlateInput
            label={t('passes.vehicle')}
            required
            value={vehicle}
            onValueChange={(value) => {
              setVehicle(value)
              if (errors.vehicle) setErrors((prev) => ({ ...prev, vehicle: undefined }))
            }}
            placeholder={t('passes.vehiclePlaceholder')}
            error={errors.vehicle}
          />

          <div>
            <p className="label">{t('passes.type')}</p>
            <Segmented
              ariaLabel={t('passes.type')}
              value={vehicleType}
              onChange={(vt) => {
                setVehicleType(vt)
                setAmount(proratedMonthlyPrice(startDate, rateForVehicle(vt)))
              }}
              options={VEHICLE_OPTIONS.map((option) => ({ id: option.id, label: t(option.label) }))}
            />
          </div>

          <div>
            <p className="label">{t('passes.plan')}</p>
            <div className="flex min-h-[58px] flex-col items-start justify-center rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
              <span className="text-sm font-semibold text-navy-900 dark:text-white">{t('plan_monthly')}</span>
              <span className="font-mono text-xs text-navy-500 dark:text-navy-300">
                {formatMoney(amount, lang)} · {t('passes.proratedHint')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label={t('passes.start')}
              type="date"
              value={startDate}
              onChange={(event) => changeStart(event.target.value)}
              icon={Calendar}
              required
            />
            <TextInput
              label={t('passes.end')}
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => {
                setEndDate(event.target.value)
                if (errors.dates) setErrors((prev) => ({ ...prev, dates: undefined }))
              }}
              icon={Calendar}
              required
              error={errors.dates}
            />
          </div>

          <TextInput
            label={t('passes.amount')}
            type="number"
            inputMode="numeric"
            min={0}
            step={10}
            value={String(amount)}
            onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
            icon={IndianRupee}
          />

          {availableAdvance > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    Available Advance Balance: {formatMoney(availableAdvance, lang)}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Remaining Payable: <span className="font-mono font-bold">{formatMoney(remainingPayable, lang)}</span>
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                  <input
                    type="checkbox"
                    checked={useAdvance}
                    onChange={(e) => {
                      setUseAdvance(e.target.checked)
                      if (e.target.checked) setAdvanceToUse(Math.min(availableAdvance, amount))
                    }}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Use
                </label>
              </div>
              {useAdvance && (
                <div className="mt-2.5">
                  <TextInput
                    label="Advance Amount to Use (₹)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={Math.min(availableAdvance, amount)}
                    value={String(advanceToUse)}
                    onChange={(e) =>
                      setAdvanceToUse(Math.min(availableAdvance, amount, Math.max(0, Number(e.target.value) || 0)))
                    }
                    icon={IndianRupee}
                  />
                </div>
              )}
            </div>
          )}

          {paymentMode === 'cash' && remainingPayable > 0 && (
            <div className="space-y-2">
              <TextInput
                label="Cash Received (₹)"
                type="number"
                inputMode="numeric"
                min={0}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={String(remainingPayable)}
                optionalLabel={t('common.optional')}
                icon={Banknote}
              />
              {cashChange > 0 && (
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <span>Save {formatMoney(cashChange, lang)} change as Customer Advance Balance</span>
                  <input
                    type="checkbox"
                    checked={saveChangeAsAdvance}
                    onChange={(e) => setSaveChangeAsAdvance(e.target.checked)}
                    className="h-4 w-4 accent-amber-600"
                  />
                </label>
              )}
            </div>
          )}

          <div>
            <p className="label">{t('admin.paymentMode')}</p>
            <Segmented<PayMode>
              ariaLabel={t('admin.paymentMode')}
              value={paymentMode}
              onChange={setPaymentMode}
              options={[
                { id: 'cash', label: t('pay.cash'), icon: Banknote },
                { id: 'upi', label: t('pay.upi'), icon: Smartphone },
                { id: 'card', label: t('pay.card'), icon: CreditCard },
              ]}
            />
            {paymentMode === 'upi' && (
              <p className="mt-1.5 text-xs leading-snug text-navy-400 dark:text-navy-300">{t('upi.qrNext')}</p>
            )}
          </div>

          <TextareaInput
            label={t('passes.notes')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('passes.notesPlaceholder')}
            optionalLabel={t('common.optional')}
          />
        </div>
      </Sheet>

      <Sheet
        open={rateOpen}
        onClose={() => (savingRate ? undefined : setRateOpen(false))}
        title={t('passes.rateTitle')}
        subtitle="Set monthly pass rates for each vehicle type"
        footer={
          <Button
            full
            loading={savingRate}
            disabled={!canEditRate}
            onClick={() => void saveRate()}
            icon={IndianRupee}
            className="min-h-[52px]"
          >
            {t('passes.rateSave')}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label={`${t('vehicle_car')} (₹)`}
              type="number"
              inputMode="numeric"
              min={1}
              step={50}
              value={rateCarDraft}
              onChange={(event) => setRateCarDraft(event.target.value)}
              icon={Car}
              required
            />
            <TextInput
              label={`${t('vehicle_suv')} (₹)`}
              type="number"
              inputMode="numeric"
              min={1}
              step={50}
              value={rateSuvDraft}
              onChange={(event) => setRateSuvDraft(event.target.value)}
              icon={Truck}
              required
            />
            <TextInput
              label={`${t('vehicle_bike')} (₹)`}
              type="number"
              inputMode="numeric"
              min={1}
              step={50}
              value={rateBikeDraft}
              onChange={(event) => setRateBikeDraft(event.target.value)}
              icon={Bike}
              required
            />
            <TextInput
              label={`${t('vehicle_ev')} (₹)`}
              type="number"
              inputMode="numeric"
              min={1}
              step={50}
              value={rateEvDraft}
              onChange={(event) => setRateEvDraft(event.target.value)}
              icon={Zap}
              required
            />
          </div>

          <p className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-xs leading-relaxed text-navy-500 dark:bg-white/[0.04] dark:text-navy-300">
            {t('passes.rateNote')}
          </p>
        </div>
      </Sheet>

      <Sheet
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        title={t('reminders.title')}
        subtitle={t('reminders.subtitle', { days: reminderDays })}
        footer={
          <Button full variant="ghost" onClick={() => setRemindersOpen(false)} className="min-h-[48px]">
            {t('action.close')}
          </Button>
        }
      >
        <div className="space-y-3">
          <p
            className={
              settings.remindersEnabled && settings.whatsappConfigured
                ? 'rounded-xl bg-[#DCFCE7] px-3.5 py-2.5 text-xs leading-relaxed text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]'
                : 'rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-200'
            }
          >
            {settings.remindersEnabled && settings.whatsappConfigured
              ? t('reminders.autoHintOn')
              : t('reminders.autoHint')}
          </p>

          {dueReminders.length === 0 ? (
            <EmptyState icon={Check} title={t('reminders.emptyTitle')} body={t('reminders.emptyBody')} />
          ) : (
            <ul className="surface divide-y divide-navy-100 overflow-hidden dark:divide-white/10">
              {dueReminders.map((pass) => {
                const left = daysLeft(pass.endDate)
                const sent = remindedKeys.has(`${pass.id}|${pass.endDate}`)
                return (
                  <li key={pass.id} className="flex items-center gap-3 p-3.5">
                    <Avatar name={pass.name} photo={pass.photo} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{pass.name}</p>
                        {sent ? (
                          <Badge tone="success" icon={Check} className="shrink-0">
                            {t('reminders.sent')}
                          </Badge>
                        ) : (
                          <Badge tone="warning" icon={Clock3} className="shrink-0">
                            {left === 0 ? t('scan.today') : t('scan.daysLeft', { n: left })}
                          </Badge>
                        )}
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
                      {canManagePasses && (
                        <button
                          type="button"
                          onClick={() => sendReminder(pass)}
                          aria-label={`${t('reminders.send')} ${pass.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#15803D] active:scale-95 dark:bg-[#16A34A]/15 dark:text-[#86EFAC]"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Sheet>

      <UpiPaySheet
        open={upiOpen}
        amount={remainingPayable}
        note={vehicle ? `${t('upi.notePass', { name: name.trim() })} ${formatPlate(vehicle)}` : t('upi.notePass', { name: name.trim() })}
        confirmLabel={t('upi.confirmPass')}
        busy={creating}
        onClose={() => {
          if (creating) return
          setUpiOpen(false)
          setFormOpen(true)
        }}
        onConfirm={(txId) => void submitCreate(txId)}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Passes"
        subtitle={`${settings.siteName} · ${list.length} passes`}
        onExport={handleExport}
      />
    </PullToRefresh>
  )
}
