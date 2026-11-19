import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  ChevronRight,
  Download,
  IndianRupee,
  Plus,
  Search,
  Ticket,
  X,
} from 'lucide-react'
import type { PassStatus, PlanId, VehicleType } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import {
  Avatar,
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
import { PullToRefresh } from '@/components/PullToRefresh'
import { ExportModal, type ExportFormat } from '@/components/ExportModal'
import { exportPassesList } from '@/lib/export'
import {
  cn,
  formatDate,
  formatMoney,
  formatPlate,
  isoDate,
  normalizePlate,
  passStatus,
  planEndDate,
  planLabel,
  PLAN_PRICE,
  PLANS,
  validPhone,
} from '@/lib/utils'

type Filter = 'all' | PassStatus

const VEHICLE_OPTIONS: { id: VehicleType; label: string }[] = [
  { id: 'car', label: 'vehicle_car' },
  { id: 'suv', label: 'vehicle_suv' },
  { id: 'bike', label: 'vehicle_bike' },
  { id: 'ev', label: 'vehicle_ev' },
]

export default function PassesPage() {
  const { passes, ready, createPass, refresh } = useData()
  const { t, lang, settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>(() => {
    const value = params.get('filter')
    return value === 'active' || value === 'expiring' || value === 'expired' ? value : 'all'
  })
  const [formOpen, setFormOpen] = useState(() => params.get('new') === '1')
  const [exportOpen, setExportOpen] = useState(false)

  const today = isoDate(new Date())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('car')
  const [plan, setPlan] = useState<PlanId>('monthly')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(isoDate(new Date(planEndDate('monthly', today))))
  const [amount, setAmount] = useState(PLAN_PRICE.monthly)
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

  const openCreate = () => {
    const start = isoDate(new Date())
    setName('')
    setPhone('')
    setVehicle('')
    setVehicleType('car')
    setPlan('monthly')
    setStartDate(start)
    setEndDate(isoDate(new Date(planEndDate('monthly', start))))
    setAmount(PLAN_PRICE.monthly)
    setNotes('')
    setErrors({})
    setFormOpen(true)
  }

  const changePlan = (next: PlanId) => {
    setPlan(next)
    setEndDate(isoDate(new Date(planEndDate(next, startDate || today))))
    setAmount(PLAN_PRICE[next])
  }

  const changeStart = (next: string) => {
    setStartDate(next)
    if (next) setEndDate(isoDate(new Date(planEndDate(plan, next))))
  }

  const handleCreate = async () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = t('walkin.requiredName')
    if (!validPhone(phone)) next.phone = t('walkin.requiredPhone')
    if (normalizePlate(vehicle).length < 6) next.vehicle = t('passes.invalidPlate')
    if (!startDate || !endDate || new Date(endDate).getTime() <= new Date(startDate).getTime()) {
      next.dates = t('passes.invalidDates')
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

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
        notes,
      })
      toast({
        message: t('passes.createdBody', { name: pass.name, date: formatDate(pass.endDate, lang) }),
        tone: 'success',
      })
      setFormOpen(false)
      navigate(`/admin/passes/${pass.id}`)
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setCreating(false)
    }
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
            <Button
              variant="ghost"
              icon={Download}
              onClick={() => setExportOpen(true)}
              disabled={!ready || list.length === 0}
              className="min-h-[44px] shrink-0 px-3.5 text-sm"
            >
              {t('reports.export')}
            </Button>
            <Button onClick={openCreate} icon={Plus} className="min-h-[44px] shrink-0 px-3.5 text-sm">
              {t('passes.new')}
            </Button>
          </div>
        </div>

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
            list.map((pass) => (
              <Link
                key={pass.id}
                to={`/admin/passes/${pass.id}`}
                className="surface flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-150 hover:border-amber-400/50 hover:shadow-md active:scale-[0.995]"
              >
                <Avatar name={pass.name} photo={pass.photo} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{pass.name}</p>
                    <PassStatusBadge pass={pass} />
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs font-semibold text-navy-600 dark:text-navy-200">
                    {formatPlate(pass.vehicle)}
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
            ))
          )}
        </div>
      </div>

      <Sheet
        open={formOpen}
        onClose={() => (creating ? undefined : setFormOpen(false))}
        title={t('passes.newTitle')}
        subtitle={t('passes.newSubtitle')}
        footer={
          <Button full loading={creating} onClick={() => void handleCreate()} icon={Ticket} className="min-h-[52px]">
            {t('passes.create')}
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
              onChange={setVehicleType}
              options={VEHICLE_OPTIONS.map((option) => ({ id: option.id, label: t(option.label) }))}
            />
          </div>

          <div>
            <p className="label">{t('passes.plan')}</p>
            <div className="grid grid-cols-2 gap-2">
              {PLANS.map((option) => {
                const active = plan === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => changePlan(option)}
                    aria-pressed={active}
                    className={cn(
                      'flex min-h-[58px] flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition-colors',
                      option === 'yearly' && 'col-span-2',
                      active
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                        : 'border-navy-100 bg-white hover:border-navy-200 dark:border-white/10 dark:bg-white/5',
                    )}
                  >
                    <span className="text-sm font-semibold text-navy-900 dark:text-white">{t(`plan_${option}`)}</span>
                    <span className="font-mono text-xs text-navy-500 dark:text-navy-300">
                      {formatMoney(PLAN_PRICE[option], lang)}
                    </span>
                  </button>
                )
              })}
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

          <TextareaInput
            label={t('passes.notes')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('passes.notesPlaceholder')}
            optionalLabel={t('common.optional')}
          />
        </div>
      </Sheet>

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
