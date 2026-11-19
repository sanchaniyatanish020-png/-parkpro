import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Banknote,
  Copy,
  CreditCard,
  Download,
  MessageCircle,
  Phone,
  Printer,
  RefreshCw,
  Smartphone,
  Ticket,
  Trash2,
} from 'lucide-react'
import type { PayMode, PlanId } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Button, EmptyState, KeyValue, PassStatusBadge, Segmented, Skeleton } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { PassCard } from '@/components/PassCard'
import { copyText, openWhatsApp, shareImage } from '@/lib/share'
import { HAPTIC, vibrate } from '@/lib/haptics'
import {
  addDays,
  addMonths,
  cn,
  daysLeft,
  formatDate,
  formatMoney,
  formatPlate,
  passStatus,
  PLAN_MONTHS,
  PLAN_PRICE,
  PLANS,
  planLabel,
} from '@/lib/utils'

export default function PassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { passes, ready, renewPass, deletePass } = useData()
  const { t, lang, settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const pass = passes.find((item) => item.id === id)
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'share' | 'download' | null>(null)

  const [renewOpen, setRenewOpen] = useState(false)
  const [plan, setPlan] = useState<PlanId>('monthly')
  const [payment, setPayment] = useState<PayMode>('cash')
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const shareText = pass
    ? t('passes.shareText', {
        name: pass.name,
        site: settings.siteName,
        vehicle: formatPlate(pass.vehicle),
        date: formatDate(pass.endDate, lang),
        token: pass.token,
      })
    : ''

  const preview = useMemo(() => {
    if (!pass) return null
    const base = new Date(Math.max(new Date(pass.endDate).getTime(), Date.now()))
    const end = plan === 'daily' ? addDays(base, 1) : addMonths(base, PLAN_MONTHS[plan])
    return { end, price: PLAN_PRICE[plan] }
  }, [pass, plan])

  const openRenew = () => {
    if (!pass) return
    setPlan(pass.plan)
    setPayment('cash')
    setRenewOpen(true)
  }

  const filename = pass ? `parkpro-${pass.token}.png` : 'parkpro-pass.png'

  const renderPassPng = async () => {
    const node = cardRef.current
    if (!node) return null
    const { toPng } = await import('html-to-image')
    return toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#0B1F3A' })
  }

  const handleShare = async () => {
    setBusy('share')
    try {
      const dataUrl = await renderPassPng()
      if (!dataUrl) return
      const result = await shareImage(dataUrl, filename, shareText)
      if (result === 'downloaded') {
        toast({ message: t('passes.shareUnsupported'), tone: 'warning' })
      }
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const handleDownload = async () => {
    setBusy('download')
    try {
      const dataUrl = await renderPassPng()
      if (!dataUrl || !pass) return
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = filename
      link.click()
      toast({ message: t('passes.downloaded'), tone: 'success' })
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    if (!pass) return
    const ok = await copyText(pass.token)
    if (ok) toast({ message: t('passes.copied'), tone: 'success' })
  }

  const handleRenew = async () => {
    if (!pass) return
    setSaving(true)
    try {
      const updated = await renewPass(pass, plan, payment)
      vibrate(HAPTIC.success, settings.haptics)
      toast({ message: t('passes.renewed', { date: formatDate(updated.endDate, lang) }), tone: 'success' })
      setRenewOpen(false)
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pass) return
    setDeleting(true)
    try {
      await deletePass(pass.id)
      toast({ message: t('passes.deleted'), tone: 'success' })
      setDeleteOpen(false)
      navigate('/admin/passes', { replace: true })
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  if (!ready) {
    return (
      <div className="px-page py-5 lg:mx-auto lg:max-w-4xl">
        <Skeleton className="mx-auto h-[460px] w-full max-w-[340px] rounded-[28px]" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!pass) {
    return (
      <div className="px-page py-8 lg:mx-auto lg:max-w-md">
        <EmptyState
          icon={Ticket}
          title={t('passes.notFound')}
          body={t('passes.notFoundBody')}
          action={
            <Link to="/admin/passes" className="btn-primary w-full">
              {t('nav.passes')}
            </Link>
          }
        />
      </div>
    )
  }

  const left = daysLeft(pass.endDate)
  const status = passStatus(pass)

  return (
    <div className="px-page py-4 lg:mx-auto lg:max-w-5xl lg:py-7">
      <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-7">
        <div className="flex flex-col items-center lg:sticky lg:top-24">
          <PassCard ref={cardRef} pass={pass} siteName={settings.siteName} printable />
          <p className="mt-3 text-center text-[11px] leading-snug text-navy-400 dark:text-navy-300 lg:max-w-[320px]">
            {t('passes.qrHint')}
          </p>
        </div>

        <div className="mt-5 lg:mt-0">
          <section className="surface p-4">
            <div className="flex items-center gap-3">
              <Avatar name={pass.name} photo={pass.photo} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-xl font-semibold text-navy-900 dark:text-white">
                    {pass.name}
                  </h2>
                  <PassStatusBadge pass={pass} />
                </div>
                <p className="mt-0.5 font-mono text-sm font-semibold tracking-wide text-navy-700 dark:text-navy-100">
                  {formatPlate(pass.vehicle)}
                </p>
                <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">+91 {pass.phone}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={`tel:+91${pass.phone}`}
                  aria-label={t('action.call')}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700 active:scale-95 dark:bg-white/10 dark:text-white"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => openWhatsApp(pass.phone, shareText)}
                  aria-label={t('passes.shareWhatsapp')}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#15803D] active:scale-95 dark:bg-[#16A34A]/15 dark:text-[#86EFAC]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <Button
                full
                icon={MessageCircle}
                loading={busy === 'share'}
                onClick={() => void handleShare()}
                className="min-h-[52px]"
              >
                {t('passes.shareWhatsapp')}
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="ghost"
                  icon={Download}
                  loading={busy === 'download'}
                  onClick={() => void handleDownload()}
                  className="min-h-[48px] px-2 text-xs"
                >
                  {t('action.download')}
                </Button>
                <Button variant="ghost" icon={Printer} onClick={() => window.print()} className="min-h-[48px] px-2 text-xs">
                  {t('passes.print')}
                </Button>
                <Button variant="ghost" icon={Copy} onClick={() => void handleCopy()} className="min-h-[48px] px-2 text-xs">
                  {t('action.copy')}
                </Button>
              </div>
            </div>
          </section>

          <section className="surface mt-4 px-4 py-1.5" aria-label={t('passes.summary')}>
            <h3 className="pt-2.5 text-xs font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
              {t('passes.summary')}
            </h3>
            <div className="divide-y divide-navy-100 dark:divide-white/10">
              <KeyValue label={t('passes.token')} value={<span className="font-mono">{pass.token}</span>} />
              <KeyValue label={t('passes.plan')} value={planLabel(pass.plan, t)} />
              <KeyValue label={t('walkin.type')} value={t(`vehicle_${pass.vehicleType}`)} />
              <KeyValue
                label={t('passes.validity')}
                value={
                  <span className="font-mono tabular-nums">
                    {formatDate(pass.startDate, lang)} → {formatDate(pass.endDate, lang)}
                  </span>
                }
              />
              <KeyValue
                label={t('passes.daysRemaining')}
                value={
                  <span className={cn('font-mono', status === 'expired' && 'text-[#B91C1C] dark:text-[#FCA5A5]')}>
                    {status === 'expired' ? t('status.expired') : left === 0 ? t('scan.today') : t('common.days', { n: left })}
                  </span>
                }
              />
              <KeyValue label={t('passes.paid')} value={<span className="font-mono">{formatMoney(pass.amount, lang)}</span>} />
              <KeyValue label={t('passes.issued')} value={formatDate(pass.createdAt, lang)} />
            </div>
          </section>

          {pass.notes && (
            <div className="surface mt-4 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
                {t('common.notes')}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-700 dark:text-navy-100">{pass.notes}</p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="navy" full icon={RefreshCw} onClick={openRenew} className="min-h-[48px]">
              {t('passes.renew')}
            </Button>
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={() => setDeleteOpen(true)}
              className="min-h-[48px] shrink-0 px-4 text-[#B91C1C] dark:text-[#FCA5A5]"
            >
              {t('action.delete')}
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={renewOpen}
        onClose={() => (saving ? undefined : setRenewOpen(false))}
        title={t('passes.renewTitle')}
        subtitle={t('passes.renewBody', { name: pass.name })}
        footer={
          <Button full loading={saving} onClick={() => void handleRenew()} icon={RefreshCw} className="min-h-[52px]">
            {t('action.renew')} · {formatMoney(preview?.price ?? 0, lang)}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl bg-navy-50 px-4 py-3 dark:bg-white/5">
            <div>
              <p className="text-[11px] font-semibold text-navy-400 dark:text-navy-300">{t('passes.validity')}</p>
              <p className="font-mono text-sm font-semibold text-navy-900 dark:text-white">
                {formatDate(pass.endDate, lang)}
              </p>
            </div>
            <span className="text-navy-300" aria-hidden="true">→</span>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-navy-400 dark:text-navy-300">{t('passes.planEnds')}</p>
              <p className="font-mono text-sm font-semibold text-[#15803D] dark:text-[#86EFAC]">
                {preview ? formatDate(preview.end, lang) : '—'}
              </p>
            </div>
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
                    onClick={() => setPlan(option)}
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
        </div>
      </Sheet>

      <Sheet
        open={deleteOpen}
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        title={t('passes.delete')}
        subtitle={t('passes.deleteBody')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" full onClick={() => setDeleteOpen(false)} disabled={deleting} className="min-h-[48px]">
              {t('action.cancel')}
            </Button>
            <Button variant="danger" full loading={deleting} onClick={() => void handleDelete()} className="min-h-[48px]">
              {t('action.delete')}
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl bg-[#FEF2F2] p-4 text-sm text-[#991B1B] dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
          <p className="font-semibold">{pass.name}</p>
          <p className="mt-0.5 font-mono text-xs">{formatPlate(pass.vehicle)} · {pass.token}</p>
        </div>
      </Sheet>
    </div>
  )
}
