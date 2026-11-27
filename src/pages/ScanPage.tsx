import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import jsQR from 'jsqr'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  CameraOff,
  CheckCircle2,
  CloudOff,
  Flashlight,
  FlashlightOff,
  Keyboard,
  Loader2,
  RefreshCw,
  ScanLine,
  SearchX,
  SwitchCamera,
  UserRoundPlus,
  X,
  XCircle,
} from 'lucide-react'
import type { ScanFeedback } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useAuth } from '@/state/AuthContext'
import { useToast } from '@/state/ToastContext'
import { defaultHomeRoute } from '@/lib/permissions'
import { Sheet } from '@/components/Sheet'
import { Button, Segmented, TextInput } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { useWakeLock } from '@/lib/wakeLock'
import {
  cameraErrorMessage,
  getCameraStream,
  getVideoTrack,
  isSecureCameraContext,
  setTorch,
  stopStream,
  torchSupported,
  type Facing,
} from '@/lib/camera'
import { vibrate, HAPTIC } from '@/lib/haptics'
import { playSound } from '@/lib/sound'
import { cn, formatDate, formatPlate, formatTime, normalizePlate } from '@/lib/utils'

type Phase = 'starting' | 'scanning' | 'processing' | 'result' | 'error'
type CameraIssue = 'denied' | 'notfound' | 'insecure' | 'unknown'

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

const OUTCOME_STYLE = {
  success: { bg: '#0F7D3E', icon: CheckCircle2, title: 'scan.entryOk' },
  expired: { bg: '#B91C1C', icon: XCircle, title: 'scan.expiredTitle' },
  expiring: { bg: '#C2410C', icon: AlertTriangle, title: 'scan.expiringTitle' },
  unknown: { bg: '#B91C1C', icon: SearchX, title: 'scan.notFoundTitle' },
} as const

export default function ScanPage() {
  const { t, settings } = useSettings()
  const { role, permissions, can } = useAuth()
  const canWalkIn = can('walkin')
  const { scan, online, pendingCount } = useData()
  const { toast } = useToast()
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const cooldownRef = useRef(0)
  const scanRef = useRef(scan)
  scanRef.current = scan

  const [phase, setPhase] = useState<Phase>('starting')
  const [issue, setIssue] = useState<CameraIssue | null>(null)
  const [facing, setFacing] = useState<Facing>('environment')
  const [torchOk, setTorchOk] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [result, setResult] = useState<ScanFeedback | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [manualOpen, setManualOpen] = useState(false)
  const [tab, setTab] = useState<'phone' | 'vehicle' | 'token'>('phone')
  const [query, setQuery] = useState('')
  const [lookupError, setLookupError] = useState('')

  useWakeLock(true)

  const showFeedback = useCallback(
    (feedback: ScanFeedback) => {
      setResult(feedback)
      setPhase('result')
      setCountdown(3)
      if (feedback.outcome === 'success') {
        playSound('success', settings.sound)
        vibrate(HAPTIC.success, settings.haptics)
      } else if (feedback.outcome === 'expiring') {
        playSound('warn', settings.sound)
        vibrate(HAPTIC.warn, settings.haptics)
      } else {
        playSound('error', settings.sound)
        vibrate(HAPTIC.error, settings.haptics)
      }
    },
    [settings.sound, settings.haptics],
  )

  const startCamera = useCallback(async (nextFacing: Facing) => {
    stopStream(streamRef.current)
    streamRef.current = null
    setPhase('starting')
    setIssue(null)
    setTorchOn(false)
    if (!isSecureCameraContext()) {
      setIssue('insecure')
      setPhase('error')
      return
    }
    try {
      const stream = await getCameraStream(nextFacing)
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      const track = getVideoTrack(stream)
      setTorchOk(torchSupported(track))
      setPhase('scanning')
    } catch (error) {
      setIssue(cameraErrorMessage(error))
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    void startCamera(facing)
    return () => {
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [facing, startCamera])

  const close = () => {
    stopStream(streamRef.current)
    streamRef.current = null
    if (window.history.length > 1) navigate(-1)
    else navigate(defaultHomeRoute(role, permissions), { replace: true })
  }

  const toggleTorch = async () => {
    const track = getVideoTrack(streamRef.current)
    const next = !torchOn
    const applied = await setTorch(track, next)
    if (!applied) {
      toast({ message: 'Torch is not supported on this camera', tone: 'warning' })
      return
    }
    setTorchOn(next)
    vibrate(HAPTIC.tap, settings.haptics)
  }

  const dismissResult = useCallback(() => {
    setResult(null)
    setPhase('scanning')
    busyRef.current = false
    cooldownRef.current = Date.now() + 1800
  }, [])

  useEffect(() => {
    if (phase !== 'result') return
    const id = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(id)
          dismissResult()
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, dismissResult])

  const handleDetected = useCallback(
    (text: string) => {
      if (busyRef.current) return
      busyRef.current = true
      setPhase('processing')
      void scanRef.current(text, 'camera').then((feedback) => {
        window.setTimeout(() => showFeedback(feedback), 220)
      })
    },
    [showFeedback],
  )

  useEffect(() => {
    if (phase !== 'scanning' || manualOpen) return
    let cancelled = false
    let last = 0
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector
    let detector: BarcodeDetectorLike | null = null
    if (Detector) {
      try {
        detector = new Detector({ formats: ['qr_code'] })
      } catch {
        detector = null
      }
    }

    let frameIndex = 0
    const tick = async (timestamp: number) => {
      if (cancelled) return
      const video = videoRef.current
      const now = Date.now()
      if (timestamp - last < 100 || !video || video.readyState < 2 || !video.videoWidth || now < cooldownRef.current) {
        loopRef.current = requestAnimationFrame(tick)
        return
      }
      last = timestamp
      frameIndex += 1

      try {
        const width = video.videoWidth
        const height = video.videoHeight
        const ratio = frameIndex % 2 === 0 ? 0.85 : 0.45
        const crop = Math.min(width, height) * ratio
        const size = 640
        canvas.width = size
        canvas.height = size
        context?.drawImage(video, (width - crop) / 2, (height - crop) / 2, crop, crop, 0, 0, size, size)

        let text: string | null = null
        if (detector) {
          try {
            const codes = await detector.detect(canvas)
            text = codes[0]?.rawValue ?? null
          } catch {
            detector = null
          }
        }
        if (!text && context) {
          const image = context.getImageData(0, 0, size, size)
          text = jsQR(image.data, size, size, { inversionAttempts: 'attemptBoth' })?.data ?? null
        }

        if (text && !cancelled) {
          handleDetected(text)
          return
        }
      } catch {
        /* frame read failed — keep scanning */
      }

      if (!cancelled) loopRef.current = requestAnimationFrame(tick)
    }

    loopRef.current = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      if (loopRef.current) cancelAnimationFrame(loopRef.current)
    }
  }, [phase, manualOpen, handleDetected])

  const submitManual = async () => {
    const value = query.trim()
    if (!value) return
    const feedback = await scan(value, 'manual')
    if (feedback.outcome === 'unknown') {
      setLookupError(t('scan.notFoundBody', { q: value }))
      vibrate(HAPTIC.error, settings.haptics)
      return
    }
    setManualOpen(false)
    setQuery('')
    setLookupError('')
    setTab('phone')
    showFeedback(feedback)
  }

  const style = result ? OUTCOME_STYLE[result.outcome] : null
  const ResultIcon = style?.icon ?? CheckCircle2
  const DirectionIcon = result?.direction === 'OUT' ? ArrowUpFromLine : ArrowDownToLine

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-navy-950 text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
      />
      <div className="absolute inset-0 bg-navy-950/50" aria-hidden="true" />

      {/* top controls */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-navy-950/80 to-transparent pb-10 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="flex items-center gap-2 px-3">
          <button
            type="button"
            onClick={close}
            aria-label={t('action.close')}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
          <h1 className="flex-1 text-center text-sm font-bold uppercase tracking-[0.16em] text-white/90">{t('scan.title')}</h1>
          <button
            type="button"
            onClick={() => void toggleTorch()}
            disabled={!torchOk}
            aria-label={torchOn ? t('scan.torchOff') : t('scan.torchOn')}
            aria-pressed={torchOn}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-colors',
              torchOk ? 'bg-white/12 text-white hover:bg-white/20' : 'bg-white/5 text-white/40',
              torchOn && 'bg-[#1868FE] text-white',
            )}
          >
            {torchOn ? <FlashlightOff className="h-5 w-5" aria-hidden="true" /> : <Flashlight className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setFacing((current) => (current === 'environment' ? 'user' : 'environment'))
              vibrate(HAPTIC.tap, settings.haptics)
            }}
            aria-label={t('scan.flip')}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <SwitchCamera className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {phase !== 'error' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6">
          <motion.div
            animate={reduced ? undefined : { scale: [1, 1.015, 1] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className="relative aspect-square w-[min(74vw,300px)] rounded-[28px] border border-white/25 shadow-[0_0_0_9999px_rgba(7,21,39,0.55)]"
          >
            <span className="absolute -left-0.5 -top-0.5 h-9 w-9 rounded-tl-2xl border-l-4 border-t-4 border-[#38BDF8]" />
            <span className="absolute -right-0.5 -top-0.5 h-9 w-9 rounded-tr-2xl border-r-4 border-t-4 border-[#38BDF8]" />
            <span className="absolute -bottom-0.5 -left-0.5 h-9 w-9 rounded-bl-2xl border-b-4 border-l-4 border-[#38BDF8]" />
            <span className="absolute -bottom-0.5 -right-0.5 h-9 w-9 rounded-br-2xl border-b-4 border-r-4 border-[#38BDF8]" />
            <span className="absolute inset-6 rounded-xl border border-dashed border-white/20" />
            {!reduced && (
              <motion.span
                className="absolute inset-x-5 h-0.5 rounded-full bg-[#38BDF8] shadow-[0_0_18px_4px_rgba(56,189,248,0.7)]"
                animate={{ top: ['10%', '88%', '10%'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {phase === 'processing' && (
              <span className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-navy-950/45">
                <Loader2 className="h-8 w-8 animate-spin text-[#38BDF8]" aria-hidden="true" />
              </span>
            )}
          </motion.div>
          <p className="mt-6 max-w-[280px] text-center text-sm font-medium text-white/85">
            {phase === 'starting' ? t('scan.starting') : phase === 'processing' ? t('scan.searching') : t('scan.align')}
          </p>
          <p className="mt-1 text-xs text-white/50">{t('scan.holdSteady')}</p>
        </div>
      )}

      {phase === 'error' && <CameraError issue={issue} onRetry={() => void startCamera(facing)} onManual={() => setManualOpen(true)} />}

      {/* bottom actions */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950 via-navy-950/80 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-16">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {!online && (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-xs font-semibold text-amber-200">
              <CloudOff className="h-4 w-4" aria-hidden="true" />
              {t('scan.offlineReady')}
            </p>
          )}
          {pendingCount > 0 && online && (
            <p className="text-center text-[11px] font-semibold text-white/60">
              {t('common.pendingSync')} · {pendingCount}
            </p>
          )}
          <div className={cn('grid gap-2.5', canWalkIn ? 'grid-cols-2' : 'grid-cols-1')}>
            {canWalkIn && (
              <button
                type="button"
                onClick={() => {
                  stopStream(streamRef.current)
                  streamRef.current = null
                  navigate('/walk-in')
                }}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] text-base font-bold text-white shadow-lg shadow-blue-500/25 active:scale-[0.99]"
              >
                <UserRoundPlus className="h-5 w-5" aria-hidden="true" />
                {t('nav.walkin')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white/95 text-base font-bold text-navy-900 active:scale-[0.99]"
            >
              <Keyboard className="h-5 w-5" aria-hidden="true" />
              {t('scan.manual')}
            </button>
          </div>
          <p className="text-center text-[11px] text-white/55">{t('scan.lockedNote')}</p>
        </div>
      </div>

      {/* result overlay */}
      <AnimatePresence>
        {phase === 'result' && result && style && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="absolute inset-0 z-40 flex flex-col"
            style={{ backgroundColor: style.bg }}
            role="status"
            aria-live="assertive"
          >
            <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                {formatTime(result.at, settings.lang)}
              </span>
              <button
                type="button"
                onClick={dismissResult}
                aria-label={t('action.close')}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/25 bg-white/15"
              >
                <ResultIcon className="h-11 w-11" aria-hidden="true" />
              </motion.div>

              <h2 className="mt-4 text-center font-display text-[32px] font-bold leading-tight">
                {result.outcome === 'success' && result.direction === 'OUT' ? 'Exit successful' : t(style.title)}
              </h2>

              {result.outcome === 'expired' && result.pass && (
                <p className="mt-1 text-center font-mono text-lg font-semibold text-white/90">
                  {formatDate(result.pass.endDate, settings.lang)}
                </p>
              )}
              {result.outcome === 'expiring' && (
                <p className="mt-1 text-center text-base font-semibold text-white/90">
                  {result.daysLeft === 0 ? t('scan.today') : t('scan.daysLeft', { n: result.daysLeft ?? 0 })}
                </p>
              )}
              {(result.outcome === 'expired' || result.outcome === 'unknown') && (
                <p className="mt-2 max-w-sm text-center text-sm leading-snug text-white/85">
                  {result.outcome === 'expired' && result.pass
                    ? t('scan.expiredBody', { date: formatDate(result.pass.endDate, settings.lang) })
                    : t('scan.notFoundBody', { q: result.message ?? '' })}
                </p>
              )}

              {result.pass && (
                <div className="mt-5 w-full max-w-sm rounded-3xl border border-white/20 bg-white/12 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={result.pass.name} photo={result.pass.photo} size="lg" className="border-2 border-white/30 bg-white/20 text-white" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-semibold">{result.pass.name}</p>
                      <p className="font-mono text-xs text-white/75">+91 {result.pass.phone}</p>
                    </div>
                    {result.outcome !== 'unknown' && (
                      <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-[11px] font-bold">
                        <DirectionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {result.direction === 'IN' ? t('history.entry') : result.direction === 'OUT' ? t('history.exit') : t('history.denied')}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 rounded-2xl bg-navy-950/35 px-3.5 py-2.5 text-center">
                    <p className="font-mono text-[26px] font-semibold tracking-[0.08em] text-white">
                      {formatPlate(result.pass.vehicle)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-white/75">{t('scan.validTill', { date: formatDate(result.pass.endDate, settings.lang) })}</span>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">
                      {result.outcome === 'expired'
                        ? t('status.expired')
                        : result.daysLeft === 0
                          ? t('scan.today')
                          : t('scan.daysLeft', { n: result.daysLeft ?? 0 })}
                    </span>
                  </div>
                </div>
              )}

              {!online && (
                <p className="mt-3 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                  <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('scan.offlineScan')}
                </p>
              )}
            </div>

            <div className="px-5 pb-[max(env(safe-area-inset-bottom),16px)]">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
                <span>{t('scan.resultAuto', { n: countdown })}</span>
                <span>{t('history.syncDone')}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                <motion.div
                  key={result.eventId ?? result.at}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 3, ease: 'linear' }}
                  className="h-full rounded-full bg-white"
                />
              </div>
              {canWalkIn && (result.outcome === 'unknown' || result.outcome === 'expired') && (
                <button
                  type="button"
                  onClick={() => {
                    stopStream(streamRef.current)
                    streamRef.current = null
                    dismissResult()
                    navigate('/walk-in', {
                      state: {
                        vehicle:
                          result.pass?.vehicle ||
                          (result.message && /^[A-Z0-9]{4,12}$/i.test(result.message) ? result.message : ''),
                        phone: result.pass?.phone || '',
                        name: result.pass?.name || '',
                      },
                    })
                  }}
                  className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white font-bold text-navy-900 shadow-lift active:scale-[0.99]"
                >
                  <UserRoundPlus className="h-5 w-5 text-[#1868FE]" aria-hidden="true" />
                  Add as Walk-In
                </button>
              )}
              <button
                type="button"
                onClick={dismissResult}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl font-bold active:scale-[0.99]",
                  result.outcome === 'unknown' || result.outcome === 'expired'
                    ? "mt-2 bg-white/20 text-white backdrop-blur hover:bg-white/30"
                    : "mt-3 bg-white text-navy-900"
                )}
              >
                <ScanLine className="h-5 w-5" aria-hidden="true" />
                {t('scan.scanAgain')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet
        open={manualOpen}
        onClose={() => {
          setManualOpen(false)
          setLookupError('')
        }}
        title={t('scan.manualTitle')}
        subtitle={t('scan.manualSubtitle')}
        footer={
          <Button full onClick={submitManual} icon={RefreshCw}>
            {t('scan.find')}
          </Button>
        }
      >
        <Segmented
          ariaLabel={t('scan.manualTitle')}
          value={tab}
          onChange={(next) => {
            setTab(next)
            setQuery('')
            setLookupError('')
          }}
          options={[
            { id: 'phone', label: t('scan.phoneTab') },
            { id: 'vehicle', label: t('scan.vehicleTab') },
            { id: 'token', label: t('scan.tokenTab') },
          ]}
          className="mb-4"
        />
        {tab === 'phone' ? (
          <TextInput
            label={t('scan.phoneTab')}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value.replace(/\D/g, '').slice(0, 10))
              setLookupError('')
            }}
            placeholder={t('scan.phonePlaceholder')}
            error={lookupError}
            autoFocus
          />
        ) : tab === 'vehicle' ? (
          <TextInput
            label={t('scan.vehicleTab')}
            value={query}
            autoCapitalize="characters"
            className="font-mono text-lg uppercase tracking-wider"
            onChange={(event) => {
              setQuery(normalizePlate(event.target.value).slice(0, 10))
              setLookupError('')
            }}
            placeholder={t('scan.vehiclePlaceholder')}
            error={lookupError}
            autoFocus
          />
        ) : (
          <TextInput
            label={t('scan.tokenTab')}
            value={query}
            className="font-mono uppercase"
            onChange={(event) => {
              setQuery(event.target.value.toUpperCase())
              setLookupError('')
            }}
            placeholder={t('scan.tokenPlaceholder')}
            error={lookupError}
            autoFocus
          />
        )}
        {lookupError ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-500/25 dark:bg-blue-500/10">
            <p className="text-xs font-semibold text-blue-950 dark:text-blue-200">
              Not found in registered passes. Add as walk-in customer?
            </p>
            <button
              type="button"
              onClick={() => {
                setManualOpen(false)
                stopStream(streamRef.current)
                streamRef.current = null
                navigate('/walk-in', {
                  state: {
                    vehicle: tab === 'vehicle' ? query : '',
                    phone: tab === 'phone' ? query : '',
                  },
                })
              }}
              className="mt-2.5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#1868FE] text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.99]"
            >
              <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
              Add as Walk-in entry
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-navy-50 px-3.5 py-2.5 text-xs text-navy-600 dark:bg-white/[0.06] dark:text-navy-200">
            <span>Customer without monthly pass?</span>
            <button
              type="button"
              onClick={() => {
                setManualOpen(false)
                stopStream(streamRef.current)
                streamRef.current = null
                navigate('/walk-in')
              }}
              className="font-bold text-[#1868FE] hover:underline dark:text-blue-400"
            >
              Add walk-in →
            </button>
          </div>
        )}
        <p className="mt-3 rounded-xl bg-navy-50/60 px-3.5 py-2 text-xs leading-relaxed text-navy-500 dark:bg-white/[0.03] dark:text-navy-300">
          {t('scan.manualFallback')}
        </p>
      </Sheet>
    </div>
  )
}

function CameraError({ issue, onRetry, onManual }: { issue: CameraIssue | null; onRetry: () => void; onManual: () => void }) {
  const { t } = useSettings()
  const insecure = issue === 'insecure'
  const Icon = insecure ? CameraOff : Camera

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-navy-950 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-end">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/60">
            {insecure ? 'HTTPS' : t('common.offline')}
          </span>
        </div>
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/15 bg-white/[0.06] text-sky-400">
            <Icon className="h-10 w-10" aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold">
            {insecure ? t('scan.insecureTitle') : t('scan.cameraDeniedTitle')}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-200">
            {insecure ? t('scan.insecureBody') : t('scan.cameraDeniedBody')}
          </p>
        </div>

        {!insecure && (
          <ol className="mt-7 space-y-2.5">
            {[t('scan.cameraStep1'), t('scan.cameraStep2'), t('scan.cameraStep3')].map((step, index) => (
              <li key={index} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1868FE] font-mono text-xs font-bold text-white shadow-sm">
                  {index + 1}
                </span>
                <p className="text-sm leading-snug text-navy-100">{step}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-7 space-y-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] font-bold text-white shadow-lg shadow-blue-500/25 active:scale-[0.99]"
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
            {t('action.retry')}
          </button>
          <button
            type="button"
            onClick={onManual}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] font-semibold text-white active:scale-[0.99]"
          >
            <Keyboard className="h-5 w-5" aria-hidden="true" />
            {t('scan.manual')}
          </button>
        </div>
      </div>
    </div>
  )
}
