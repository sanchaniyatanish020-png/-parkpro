import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bike,
  Camera,
  CameraOff,
  Car,
  CarFront,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  IndianRupee,
  Loader2,
  RefreshCw,
  SwitchCamera,
  Truck,
  UserRoundPlus,
  Zap,
} from 'lucide-react'
import type { VehicleType, WalkIn } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Badge, Button, PlateInput, PhoneInput, Segmented, TextInput } from '@/components/ui'
import { PullToRefresh } from '@/components/PullToRefresh'
import { captureVideoFrame, getCameraStream, stopStream, type Facing } from '@/lib/camera'
import { compressImage, type CompressedImage } from '@/lib/image'
import { HAPTIC, vibrate } from '@/lib/haptics'
import { cn, formatDateTime, formatMoney, formatPlate, validPhone } from '@/lib/utils'

const TYPES: { id: VehicleType; icon: typeof Car }[] = [
  { id: 'car', icon: Car },
  { id: 'suv', icon: Truck },
  { id: 'bike', icon: Bike },
  { id: 'ev', icon: Zap },
]

export default function WalkInPage() {
  const { addWalkIn, online, refresh } = useData()
  const { t, lang, settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [facing, setFacing] = useState<Facing>('user')
  const [camState, setCamState] = useState<'starting' | 'live' | 'error' | 'off'>('starting')
  const [photo, setPhoto] = useState<CompressedImage | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('car')
  const [amount, setAmount] = useState(120)
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<WalkIn | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const hasPhoto = photo !== null

  useEffect(() => {
    if (saved) {
      stopStream(streamRef.current)
      streamRef.current = null
      return
    }
    if (hasPhoto) return

    let cancelled = false
    setCamState('starting')
    void (async () => {
      try {
        const stream = await getCameraStream(facing)
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setCamState('live')
      } catch {
        if (!cancelled) setCamState('error')
      }
    })()

    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [facing, hasPhoto, saved, retryKey])

  const takePhoto = async () => {
    const video = videoRef.current
    if (!video || camState !== 'live') return
    const raw = captureVideoFrame(video)
    if (!raw) return
    setCompressing(true)
    try {
      const compressed = await compressImage(raw)
      setPhoto(compressed)
      vibrate(HAPTIC.success, settings.haptics)
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setCompressing(false)
    }
  }

  const retake = () => {
    vibrate(HAPTIC.tap, settings.haptics)
    setPhoto(null)
  }

  const flip = () => {
    vibrate(HAPTIC.tap, settings.haptics)
    setFacing((current) => (current === 'user' ? 'environment' : 'user'))
  }

  const retryCamera = () => {
    setRetryKey((key) => key + 1)
  }

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = t('walkin.requiredName')
    if (!validPhone(phone)) next.phone = t('walkin.requiredPhone')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      vibrate(HAPTIC.error, settings.haptics)
      return
    }
    setSaving(true)
    try {
      const entry = await addWalkIn({
        name,
        phone,
        vehicle: vehicle || undefined,
        vehicleType,
        photo: photo?.dataUrl,
        amount,
      })
      vibrate(HAPTIC.success, settings.haptics)
      setSaved(entry)
    } catch {
      toast({ message: t('toast.error'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSaved(null)
    setName('')
    setPhone('')
    setVehicle('')
    setVehicleType('car')
    setAmount(120)
    setPhoto(null)
    setErrors({})
    setFacing('user')
  }

  if (saved) {
    return (
      <div className="px-page py-6 lg:mx-auto lg:max-w-xl lg:py-10">
        <div className="surface p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/20 dark:text-[#86EFAC]">
            <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-900 dark:text-white">{t('walkin.saved')}</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-200">
            {t('walkin.savedBody', {
              name: saved.name,
              vehicle: saved.vehicle ? formatPlate(saved.vehicle) : saved.phone,
              amount: formatMoney(saved.amount, lang),
            })}
          </p>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-navy-50 p-3.5 text-left dark:bg-white/5">
            <Avatar name={saved.name} photo={saved.photo} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{saved.name}</p>
              <p className="mt-0.5 font-mono text-xs text-navy-500 dark:text-navy-200">
                {saved.vehicle ? formatPlate(saved.vehicle) : '—'} · +91 {saved.phone}
              </p>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-300">{formatDateTime(saved.at, lang)}</p>
            </div>
            <div className="shrink-0">
              {saved.synced ? (
                <Badge tone="success" icon={CheckCircle2}>
                  {t('common.synced')}
                </Badge>
              ) : (
                <Badge tone="warning" icon={CloudOff}>
                  {t('common.pending')}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Button full onClick={resetForm} icon={UserRoundPlus} className="min-h-[52px]">
              {t('walkin.new')}
            </Button>
            <Button variant="ghost" full onClick={() => navigate('/history')} icon={ChevronRight} className="min-h-[48px]">
              {t('nav.history')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-2xl lg:py-7">
        <p className="text-sm text-navy-500 dark:text-navy-200">{t('walkin.subtitle')}</p>

        <div className="mt-4 flex items-center gap-2" aria-hidden="true">
          <StepChip label={t('walkin.stepPhoto')} state={photo ? 'done' : 'active'} />
          <span className="h-px flex-1 bg-navy-200 dark:bg-white/15" />
          <StepChip label={t('walkin.stepDetails')} state={photo ? 'active' : 'idle'} />
          <span className="h-px flex-1 bg-navy-200 dark:bg-white/15" />
          <StepChip label={t('walkin.stepPay')} state="idle" />
        </div>

        <section className="mt-4" aria-label={t('walkin.photo')}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-navy-950">
            {photo ? (
              <>
                <img src={photo.dataUrl} alt={t('walkin.photo')} className="h-full w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-navy-950/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                  {t('walkin.photoReady', { size: Math.max(1, Math.round(photo.bytes / 1024)) })}
                </span>
                <button
                  type="button"
                  onClick={retake}
                  className="absolute right-3 top-3 flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-bold text-navy-900 shadow-soft active:scale-95"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {t('walkin.retake')}
                </button>
              </>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label={t('walkin.photo')}
                  className={cn(
                    'h-full w-full object-cover transition-opacity',
                    facing === 'user' && 'scale-x-[-1]',
                    camState === 'live' ? 'opacity-100' : 'opacity-0',
                  )}
                />

                {camState === 'starting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-navy-200">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-400" aria-hidden="true" />
                    <p className="text-sm font-medium">{t('scan.starting')}</p>
                  </div>
                )}

                {camState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-amber-400">
                      <CameraOff className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <p className="max-w-xs text-sm text-navy-200">{t('walkin.noCamera')}</p>
                    <button
                      type="button"
                      onClick={retryCamera}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white active:scale-95"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      {t('action.retry')}
                    </button>
                  </div>
                )}

                {camState === 'live' && (
                  <>
                    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-navy-950/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-[#22C55E]" aria-hidden="true" />
                      {t('walkin.photo')}
                    </span>
                    <button
                      type="button"
                      onClick={flip}
                      aria-label={t('walkin.flip')}
                      className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy-950/60 text-white backdrop-blur active:scale-95"
                    >
                      <SwitchCamera className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-navy-950/85 to-transparent px-4 pb-5 pt-10">
                      <button
                        type="button"
                        onClick={() => void takePhoto()}
                        disabled={compressing}
                        aria-label={t('walkin.takePhoto')}
                        className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-4 border-white/70 bg-amber-500 text-navy-900 shadow-fab transition-transform active:scale-95 disabled:opacity-70"
                      >
                        {compressing ? (
                          <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                        ) : (
                          <Camera className="h-7 w-7" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                      {t('walkin.photoHint')}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </section>

        <section className="mt-5 space-y-4" aria-label={t('walkin.stepDetails')}>
          <TextInput
            label={t('walkin.name')}
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            placeholder={t('walkin.namePlaceholder')}
            autoComplete="name"
            autoCapitalize="words"
            error={errors.name}
            icon={UserRoundPlus}
          />

          <PhoneInput
            label={t('walkin.phone')}
            required
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
            }}
            error={errors.phone}
          />

          <PlateInput
            label={t('walkin.vehicle')}
            value={vehicle}
            onValueChange={setVehicle}
            placeholder={t('walkin.vehiclePlaceholder')}
            optionalLabel={t('common.optional')}
            autoComplete="off"
          />

          <div>
            <p className="label">{t('walkin.type')}</p>
            <Segmented
              ariaLabel={t('walkin.type')}
              value={vehicleType}
              onChange={setVehicleType}
              options={TYPES.map((type) => ({ id: type.id, label: t(`vehicle_${type.id}`), icon: type.icon }))}
            />
          </div>

          <TextInput
            label={t('walkin.charge')}
            type="number"
            inputMode="numeric"
            min={0}
            step={10}
            value={String(amount)}
            onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
            icon={IndianRupee}
            hint={formatMoney(amount, lang)}
          />

          {!online && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs font-medium text-[#7C4A00] dark:bg-amber-500/10 dark:text-amber-200">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('common.offlineBanner')}</span>
            </div>
          )}

          <div className="sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+10px)] z-20 rounded-2xl border border-navy-100 bg-white/95 p-2 shadow-lift backdrop-blur dark:border-white/10 dark:bg-navy-900/95 lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none dark:lg:bg-transparent">
            <Button full loading={saving} onClick={() => void handleSave()} icon={CarFront} className="min-h-[54px]">
              {saving ? t('walkin.saving') : t('walkin.save')}
            </Button>
          </div>
        </section>
      </div>
    </PullToRefresh>
  )
}

function StepChip({ label, state }: { label: string; state: 'done' | 'active' | 'idle' }) {
  return (
    <span
      className={cn(
        'flex min-h-[30px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold',
        state === 'done' && 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]',
        state === 'active' && 'bg-amber-500 text-navy-900',
        state === 'idle' && 'bg-navy-100 text-navy-500 dark:bg-white/10 dark:text-navy-300',
      )}
    >
      {state === 'done' && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  )
}
