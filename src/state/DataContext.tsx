import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AuditLog,
  Direction,
  NewPassInput,
  NewWalkInInput,
  ParkedItem,
  Pass,
  PayMode,
  PlanId,
  ReminderRecord,
  ReminderRunResult,
  ScanEvent,
  ScanFeedback,
  ScanOutcome,
  SiteStats,
  WalkIn,
} from '@/types'
import { db } from '@/lib/db'
import { api, ApiError, hasToken } from '@/lib/api'
import { startLiveUpdates } from '@/lib/live'
import { buildPaymentRecords } from '@/lib/payments'
import { daysLeft, normalizePlate, passStatus, renewMonthEndAndPrice, uid } from '@/lib/utils'
import { useAuth } from '@/state/AuthContext'
import { useToast } from '@/state/ToastContext'
import { useSettings } from '@/state/SettingsContext'

type ScanSource = 'camera' | 'manual'

interface DataContextValue {
  ready: boolean
  passes: Pass[]
  scans: ScanEvent[]
  walkins: WalkIn[]
  logs: AuditLog[]
  reminders: ReminderRecord[]
  parked: ParkedItem[]
  expiring: Pass[]
  stats: SiteStats
  pendingCount: number
  online: boolean
  syncing: boolean
  lastSync: string | null
  findPass: (query: string) => Pass | undefined
  scan: (text: string, source: ScanSource) => Promise<ScanFeedback>
  createPass: (input: NewPassInput) => Promise<Pass>
  renewPass: (pass: Pass, plan: PlanId, payment: PayMode) => Promise<Pass>
  deletePass: (id: string) => Promise<void>
  addWalkIn: (input: NewWalkInInput) => Promise<WalkIn>
  updateSite: (patch: {
    name?: string
    capacity?: number
    monthlyRate?: number
    rateCar?: number
    rateSuv?: number
    rateBike?: number
    rateEv?: number
    upiId?: string
    upiName?: string
    remindersEnabled?: boolean
    reminderDays?: number
    whatsappTemplate?: string
    whatsappLang?: string
  }) => Promise<boolean>
  markReminder: (
    passId: string,
    message?: string,
    options?: { channel?: ReminderRecord['channel']; status?: ReminderRecord['status']; reminderType?: string },
  ) => Promise<void>
  runReminders: () => Promise<ReminderRunResult>
  syncNow: (manual?: boolean) => Promise<void>
  refresh: () => Promise<void>
  reset: () => Promise<void>
  clearLogs: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const LAST_SYNC_KEY = 'parkpro.lastSync'

function sortByAtDesc<T extends { at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

/** Server rows win, but records captured offline are kept until they sync. */
function mergePending<T extends { id: string; synced: boolean }>(cached: T[], remote: T[]): T[] {
  const remoteIds = new Set(remote.map((item) => item.id))
  return [...cached.filter((item) => !item.synced && !remoteIds.has(item.id)), ...remote]
}

function mergeLogs(cached: AuditLog[], remote: AuditLog[]): AuditLog[] {
  const remoteIds = new Set(remote.map((log) => log.id))
  return [...cached.filter((log) => !remoteIds.has(log.id)), ...remote]
}

function tokenFromPayload(text: string): string {
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const param = url.searchParams.get('p') ?? url.searchParams.get('token') ?? url.searchParams.get('pass')
      if (param) return param.toUpperCase()
      const last = url.pathname.split('/').filter(Boolean).pop()
      if (last) return last.toUpperCase()
    } catch {
      /* treat as raw text */
    }
  }
  return trimmed.toUpperCase().replace(/\s+/g, '')
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { settings, update, t } = useSettings()
  const { toast } = useToast()
  const { name: collectorName, username: collectorUsername } = useAuth()

  const [passes, setPasses] = useState<Pass[]>([])
  const [scans, setScans] = useState<ScanEvent[]>([])
  const [walkins, setWalkins] = useState<WalkIn[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [reminders, setReminders] = useState<ReminderRecord[]>([])
  const [ready, setReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_KEY))
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  const online = browserOnline && !settings.simulateOffline
  const onlineRef = useRef(online)
  onlineRef.current = online
  const scansRef = useRef(scans)
  scansRef.current = scans
  const walkinsRef = useRef(walkins)
  walkinsRef.current = walkins
  const logsRef = useRef(logs)
  logsRef.current = logs

  const pendingCount = useMemo(
    () => scans.filter((s) => !s.synced).length + walkins.filter((w) => !w.synced).length,
    [scans, walkins],
  )
  const pendingRef = useRef(pendingCount)
  pendingRef.current = pendingCount

  const hydrate = useCallback(async () => {
    if (!hasToken()) return
    const payload = await api.bootstrap()
    const nextScans = sortByAtDesc(mergePending(scansRef.current, payload.scans))
    const nextWalkins = sortByAtDesc(mergePending(walkinsRef.current, payload.walkins))
    const nextLogs = sortByAtDesc(mergeLogs(logsRef.current, payload.logs))

    setPasses(payload.passes)
    setScans(nextScans)
    setWalkins(nextWalkins)
    setLogs(nextLogs)
    setReminders(payload.reminders ?? [])
    update({
      siteName: payload.site.name,
      capacity: payload.site.capacity,
      monthlyRate: payload.site.monthlyRate ?? 1800,
      rateCar: payload.site.rateCar ?? 1800,
      rateSuv: payload.site.rateSuv ?? 1800,
      rateBike: payload.site.rateBike ?? 1200,
      rateEv: payload.site.rateEv ?? 1800,
      upiId: payload.site.upiId ?? '',
      upiName: payload.site.upiName ?? '',
      remindersEnabled: payload.site.remindersEnabled ?? false,
      reminderDays: payload.site.reminderDays ?? 3,
      whatsappTemplate: payload.site.whatsappTemplate ?? '',
      whatsappLang: payload.site.whatsappLang ?? 'en',
      whatsappConfigured: payload.site.whatsappConfigured ?? false,
    })
    if (payload.user) {
      window.dispatchEvent(new CustomEvent('parkpro:user', { detail: payload.user }))
    }
    setLastSync(payload.at)
    localStorage.setItem(LAST_SYNC_KEY, payload.at)

    void db.replacePasses(payload.passes)
    void db.replaceScans(nextScans)
    void db.replaceWalkIns(nextWalkins)
    void db.replaceLogs(nextLogs)
  }, [update])

  const addLog = useCallback(async (entry: Omit<AuditLog, 'id' | 'at'> & { at?: string }) => {
    const log: AuditLog = {
      id: uid('log_'),
      at: entry.at ?? new Date().toISOString(),
      kind: entry.kind,
      message: entry.message,
      level: entry.level,
      meta: entry.meta,
    }
    setLogs((prev) => [log, ...prev])
    void db.putLog(log)
    if (onlineRef.current) void api.createLog(log).catch(() => undefined)
    return log
  }, [])

  const findPass = useCallback(
    (query: string): Pass | undefined => {
      const raw = query.trim()
      if (!raw) return undefined
      const token = tokenFromPayload(raw)
      const plate = normalizePlate(raw)
      const digits = raw.replace(/\D/g, '')
      return (
        passes.find((p) => p.token.toUpperCase() === token) ??
        passes.find((p) => p.vehicle === plate) ??
        (digits.length >= 10 ? passes.find((p) => p.phone === digits.slice(-10)) : undefined)
      )
    },
    [passes],
  )

  /** Same rules the API applies — used when the gate device has no connection. */
  const scanLocally = useCallback(
    (text: string, source: ScanSource): ScanFeedback => {
      const now = new Date()
      const at = now.toISOString()
      const pass = findPass(text)
      const synced = onlineRef.current

      if (!pass) {
        const event: ScanEvent = {
          id: uid('s_'),
          token: text.slice(0, 48),
          direction: 'DENIED',
          outcome: 'unknown',
          at,
          source,
          synced,
        }
        setScans((prev) => [event, ...prev])
        void db.putScan(event)
        void addLog({ kind: 'scan', message: `Unknown pass scanned${synced ? '' : ' offline'}`, level: 'warn', at })
        return { outcome: 'unknown', direction: 'DENIED', at, message: text, eventId: event.id }
      }

      const status = passStatus(pass, now)
      const lastReal = scansRef.current.find((s) => s.passId === pass.id && s.direction !== 'DENIED')
      const nextDirection: Direction = lastReal?.direction === 'IN' ? 'OUT' : 'IN'
      const outcome: ScanOutcome = status === 'expired' ? 'expired' : status === 'expiring' ? 'expiring' : 'success'
      const direction: Direction = status === 'expired' ? 'DENIED' : nextDirection

      const event: ScanEvent = {
        id: uid('s_'),
        passId: pass.id,
        token: pass.token,
        name: pass.name,
        phone: pass.phone,
        vehicle: pass.vehicle,
        photo: pass.photo,
        direction,
        outcome,
        at,
        source,
        synced,
      }
      setScans((prev) => [event, ...prev])
      void db.putScan(event)

      const label = direction === 'IN' ? 'Entry' : direction === 'OUT' ? 'Exit' : 'Denied'
      void addLog({
        kind: 'scan',
        message: `${label} · ${pass.name} · ${pass.vehicle}${status === 'expiring' ? ' · expiring' : ''}${
          status === 'expired' ? ' · pass expired' : ''
        }`,
        level: direction === 'DENIED' ? 'error' : status === 'expiring' ? 'warn' : 'success',
        at,
        meta: { passId: pass.id, direction },
      })

      return { outcome, direction, pass, daysLeft: daysLeft(pass.endDate, now), at, eventId: event.id }
    },
    [findPass, addLog],
  )

  const scan = useCallback(
    async (text: string, source: ScanSource): Promise<ScanFeedback> => {
      if (onlineRef.current) {
        try {
          const response = await api.scan(text, source)
          setScans((prev) => [response.event, ...prev])
          void db.putScan(response.event)
          if (response.pass) {
            const updatedPass = response.pass
            setPasses((prev) => prev.map((p) => (p.id === updatedPass.id ? updatedPass : p)))
          }
          const label = response.direction === 'IN' ? 'Entry' : response.direction === 'OUT' ? 'Exit' : 'Denied'
          await addLog({
            kind: 'scan',
            message: response.pass
              ? `${label} · ${response.pass.name} · ${response.pass.vehicle}${
                  response.outcome === 'expiring' ? ' · expiring' : ''
                }${response.outcome === 'expired' ? ' · pass expired' : ''}`
              : 'Unknown pass scanned',
            level:
              response.direction === 'DENIED' ? 'error' : response.outcome === 'expiring' ? 'warn' : 'success',
            meta: { passId: response.pass?.id, direction: response.direction },
          })
          return {
            outcome: response.outcome,
            direction: response.direction,
            pass: response.pass,
            daysLeft: response.daysLeft,
            at: response.at,
            message: response.message,
            eventId: response.event.id,
          }
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 0) {
            toast({ message: error instanceof Error ? error.message : 'Scan failed', tone: 'error' })
            return { outcome: 'unknown', direction: 'DENIED', at: new Date().toISOString() }
          }
          // Network dropped mid-scan — fall through to the offline decision.
        }
      }
      return scanLocally(text, source)
    },
    [addLog, scanLocally, toast],
  )

  const createPass = useCallback(
    async (input: NewPassInput): Promise<Pass> => {
      const now = new Date()
      let token = `PRKP-${uid().slice(0, 6).toUpperCase()}`
      while (passes.some((p) => p.token === token)) token = `PRKP-${uid('').slice(0, 6).toUpperCase()}`
      const pass: Pass = {
        id: uid('p_'),
        token,
        name: input.name.trim(),
        phone: input.phone.trim(),
        vehicle: normalizePlate(input.vehicle),
        vehicleType: input.vehicleType,
        plan: input.plan,
        startDate: input.startDate,
        endDate: input.endDate,
        amount: input.amount,
        paymentMode: input.paymentMode ?? 'cash',
        collectedBy: collectorName || undefined,
        collectedByUsername: collectorUsername || undefined,
        slot: input.slot?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        photo: input.photo,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      const response = await api.createPass(pass)
      const savedPass = response.pass ?? pass
      setPasses((prev) => [savedPass, ...prev])
      void db.putPass(savedPass)
      await addLog({
        kind: 'pass',
        message: `New ${input.plan.replace('_', ' ')} pass · ${savedPass.name} · ${savedPass.vehicle} · ₹${input.amount} (${savedPass.paymentMode})`,
        level: 'success',
        meta: { passId: savedPass.id, amount: input.amount, payment: savedPass.paymentMode },
      })
      return savedPass
    },
    [passes, addLog, collectorName, collectorUsername],
  )

  const renewPass = useCallback(
    async (pass: Pass, plan: PlanId, payment: PayMode): Promise<Pass> => {
      const now = new Date()
      const vehicleRate =
        pass.vehicleType === 'suv'
          ? settings.rateSuv
          : pass.vehicleType === 'bike'
            ? settings.rateBike
            : pass.vehicleType === 'ev'
              ? settings.rateEv
              : settings.rateCar
      const { end, price } = renewMonthEndAndPrice(pass.endDate, now, vehicleRate || settings.monthlyRate)
      const updated: Pass = {
        ...pass,
        plan,
        endDate: end.toISOString(),
        amount: pass.amount + price,
        paymentMode: payment,
        updatedAt: now.toISOString(),
      }
      const result = await api.updatePass(updated)
      setPasses((prev) => prev.map((p) => (p.id === pass.id ? result.pass : p)))
      void db.putPass(result.pass)
      await addLog({
        kind: 'pass',
        message: `Renewed ${pass.name} · ${pass.vehicle} · monthly · ₹${price} (${payment})`,
        level: 'success',
        meta: {
          passId: pass.id,
          amount: price,
          payment,
          collectedBy: collectorName || undefined,
          collectedByUsername: collectorUsername || undefined,
        },
      })
      return result.pass
    },
    [addLog, collectorName, collectorUsername, settings.monthlyRate, settings.rateCar, settings.rateSuv, settings.rateBike, settings.rateEv],
  )

  const deletePass = useCallback(
    async (id: string) => {
      const pass = passes.find((p) => p.id === id)
      await api.deletePass(id)
      setPasses((prev) => prev.filter((p) => p.id !== id))
      void db.deletePass(id)
      if (pass) {
        await addLog({ kind: 'pass', message: `Pass deleted · ${pass.name} · ${pass.vehicle}`, level: 'warn' })
      }
    },
    [passes, addLog],
  )

  const addWalkIn = useCallback(
    async (input: NewWalkInInput): Promise<WalkIn> => {
      const entry: WalkIn = {
        id: uid('w_'),
        name: input.name.trim(),
        phone: input.phone.trim(),
        vehicle: input.vehicle ? normalizePlate(input.vehicle) : undefined,
        vehicleType: input.vehicleType,
        photo: input.photo,
        amount: input.amount,
        paymentMode: input.paymentMode ?? 'cash',
        collectedBy: collectorName || undefined,
        collectedByUsername: collectorUsername || undefined,
        at: new Date().toISOString(),
        synced: onlineRef.current,
      }
      let savedEntry = entry
      if (onlineRef.current) {
        try {
          const response = await api.createWalkIn(entry)
          if (response.walkin) savedEntry = response.walkin
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 0) throw error
          savedEntry = { ...entry, synced: false }
        }
      }
      await db.putWalkIn(savedEntry)
      setWalkins((prev) => [savedEntry, ...prev])
      await addLog({
        kind: 'walkin',
        message: `Walk-in · ${savedEntry.name} · ${savedEntry.vehicle ?? 'no vehicle'} · ₹${savedEntry.amount} (${savedEntry.paymentMode})${
          savedEntry.synced ? '' : ' · queued offline'
        }`,
        level: 'success',
        meta: { amount: savedEntry.amount, payment: savedEntry.paymentMode },
      })
      return savedEntry
    },
    [addLog, collectorName, collectorUsername],
  )

  const syncNow = useCallback(
    async (manual = true) => {
      if (!onlineRef.current || syncing) {
        if (manual && !onlineRef.current) toast({ message: t('common.offlineBanner'), tone: 'warning' })
        return
      }
      const pendingScans = scansRef.current.filter((s) => !s.synced)
      const pendingWalkins = walkinsRef.current.filter((w) => !w.synced)
      const total = pendingScans.length + pendingWalkins.length
      if (total === 0) {
        setLastSync(new Date().toISOString())
        if (manual) toast({ message: t('history.allSynced'), tone: 'success' })
        return
      }

      setSyncing(true)
      try {
        const result = await api.sync({ scans: pendingScans, walkins: pendingWalkins })
        const scanIds = new Set(pendingScans.map((s) => s.id))
        const walkinIds = new Set(pendingWalkins.map((w) => w.id))
        setScans((prev) => prev.map((s) => (scanIds.has(s.id) ? { ...s, synced: true } : s)))
        setWalkins((prev) => prev.map((w) => (walkinIds.has(w.id) ? { ...w, synced: true } : w)))
        void Promise.all([
          ...pendingScans.map((s) => db.putScan({ ...s, synced: true })),
          ...pendingWalkins.map((w) => db.putWalkIn({ ...w, synced: true })),
        ])
        setLastSync(result.at)
        localStorage.setItem(LAST_SYNC_KEY, result.at)
        await addLog({
          kind: 'sync',
          message: `${total} records uploaded to the server`,
          level: 'success',
          meta: { count: total },
        })
        toast({ message: t('toast.synced'), tone: 'success' })
      } catch (error) {
        toast({ message: error instanceof Error ? error.message : t('toast.error'), tone: 'error' })
      } finally {
        setSyncing(false)
      }
    },
    [syncing, toast, t, addLog],
  )

  const refresh = useCallback(async () => {
    try {
      await hydrate()
    } catch {
      toast({ message: t('common.offlineBanner'), tone: 'warning' })
    }
  }, [hydrate, toast, t])

  // Background pull: failures are silent because cached data is still shown.
  const pulling = useRef(false)
  const pullRemote = useCallback(async () => {
    if (pulling.current) return
    pulling.current = true
    try {
      await hydrate()
    } catch {
      /* offline or server hiccup — keep showing the cached snapshot */
    } finally {
      pulling.current = false
    }
  }, [hydrate])

  useEffect(() => {
    if (!hasToken()) return
    return startLiveUpdates({
      isOnline: () => onlineRef.current,
      onChange: () => void pullRemote(),
    })
  }, [pullRemote])

  const reset = useCallback(async () => {
    setReady(false)
    try {
      await api.resetDemo()
      await hydrate()
      toast({ message: t('settings.resetDone'), tone: 'success' })
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : t('toast.error'), tone: 'error' })
    } finally {
      setReady(true)
    }
  }, [hydrate, toast, t])

  const clearLogs = useCallback(async () => {
    try {
      if (onlineRef.current) await api.clearLogs()
    } catch {
      /* clearing locally is still useful */
    }
    await db.clearLogs()
    setLogs([])
    toast({ message: t('logs.cleared'), tone: 'success' })
  }, [toast, t])

  const updateSite = useCallback(
    async (patch: {
      name?: string
      capacity?: number
      monthlyRate?: number
      upiId?: string
      upiName?: string
      remindersEnabled?: boolean
      reminderDays?: number
      whatsappTemplate?: string
      whatsappLang?: string
    }) => {
      try {
        const { site } = await api.updateSite(patch)
        update({
          siteName: site.name,
          capacity: site.capacity,
          monthlyRate: site.monthlyRate,
          upiId: site.upiId ?? '',
          upiName: site.upiName ?? '',
          remindersEnabled: site.remindersEnabled ?? false,
          reminderDays: site.reminderDays ?? 3,
          whatsappTemplate: site.whatsappTemplate ?? '',
          whatsappLang: site.whatsappLang ?? 'en',
          whatsappConfigured: site.whatsappConfigured ?? false,
        })
        return true
      } catch (error) {
        toast({
          message: error instanceof Error ? error.message : t('toast.error'),
          tone: error instanceof ApiError && error.status === 0 ? 'warning' : 'error',
        })
        return false
      }
    },
    [update, toast, t],
  )

  const markReminder = useCallback(
    async (
      passId: string,
      message?: string,
      options?: { channel?: ReminderRecord['channel']; status?: ReminderRecord['status']; reminderType?: string },
    ) => {
      const pass = passes.find((item) => item.id === passId)
      if (!pass) return
      try {
        const { reminder } = await api.markReminder(passId, {
          message,
          channel: options?.channel ?? 'manual',
          status: options?.status ?? 'sent',
          reminderType: options?.reminderType ?? 'expiring',
        })
        setReminders((prev) => [
          reminder,
          ...prev.filter(
            (item) =>
              !(
                item.passId === reminder.passId &&
                item.endDate === reminder.endDate &&
                (item.reminderType ?? 'expiring') === (reminder.reminderType ?? 'expiring')
              ),
          ),
        ])
      } catch {
        /* tracking is best-effort */
      }
    },
    [passes],
  )

  const runReminders = useCallback(async () => {
    const result = await api.runReminders()
    try {
      await hydrate()
    } catch {
      /* show the summary even if the refresh fails */
    }
    return result
  }, [hydrate])

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true)
    const onOffline = () => setBrowserOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const bootedRef = useRef(false)
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    void (async () => {
      try {
        const [cachedPasses, cachedScans, cachedWalkins, cachedLogs] = await Promise.all([
          db.getPasses(),
          db.getScans(),
          db.getWalkIns(),
          db.getLogs(),
        ])
        setPasses(cachedPasses)
        setScans(sortByAtDesc(cachedScans))
        setWalkins(sortByAtDesc(cachedWalkins))
        setLogs(sortByAtDesc(cachedLogs))
      } catch {
        /* cache unavailable — the server copy will fill in */
      }
      setReady(true)
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          if (hasToken()) {
            await hydrate()
          }
        } catch {
          /* offline start — cached data is displayed */
        }
      }
    })()
  }, [hydrate])

  // Pull fresh data and flush the offline queue whenever connectivity returns.
  const prevOnline = useRef(online)
  useEffect(() => {
    const wasOnline = prevOnline.current
    prevOnline.current = online
    if (wasOnline && !online) {
      toast({ message: t('toast.offline'), tone: 'warning' })
    }
    if (!wasOnline && online) {
      toast({ message: t('toast.online'), tone: 'info' })
      void (async () => {
        try {
          await hydrate()
        } catch {
          /* ignore */
        }
        if (pendingRef.current > 0) await syncNow(false)
      })()
    }
  }, [online, toast, t, syncNow, hydrate])

  const stats: SiteStats = useMemo(() => {
    const now = new Date()
    const todayKey = now.toDateString()
    const activePasses = passes.filter((p) => passStatus(p, now) !== 'expired').length
    const expiringCount = passes.filter((p) => passStatus(p, now) === 'expiring').length
    const expiredCount = passes.length - activePasses
    const walkinsToday = walkins.filter((w) => new Date(w.at).toDateString() === todayKey)
    const allPayments = buildPaymentRecords({ passes, walkins, logs })
    const todayPayments = allPayments.filter((item) => new Date(item.at).toDateString() === todayKey)

    let todayCashRevenue = 0
    let todayOnlineRevenue = 0
    let todayCashCount = 0
    let todayOnlineCount = 0
    for (const item of todayPayments) {
      if (item.paymentMode === 'cash') {
        todayCashRevenue += item.amount
        todayCashCount += 1
      } else {
        todayOnlineRevenue += item.amount
        todayOnlineCount += 1
      }
    }

    const todayRevenue = todayCashRevenue + todayOnlineRevenue
    const todayEntries =
      scans.filter((s) => new Date(s.at).toDateString() === todayKey && s.direction === 'IN').length +
      walkinsToday.length

    return {
      activePasses,
      expiring: expiringCount,
      expired: expiredCount,
      parked: 0,
      walkinsToday: walkinsToday.length,
      capacity: settings.capacity,
      occupied: 0,
      occupancyPct: 0,
      todayRevenue,
      todayCashRevenue,
      todayOnlineRevenue,
      todayCashCount,
      todayOnlineCount,
      todayPayments,
      todayEntries,
      pending: pendingCount,
      totalPasses: passes.length,
      totalRevenue: passes.reduce((sum, p) => sum + p.amount, 0) + walkins.reduce((sum, w) => sum + w.amount, 0),
    }
  }, [passes, walkins, scans, logs, pendingCount, settings.capacity])

  const parked = useMemo<ParkedItem[]>(() => {
    const latest = new Map<string, ScanEvent>()
    for (const event of scans) {
      if (!event.passId || event.direction === 'DENIED') continue
      if (!latest.has(event.passId)) latest.set(event.passId, event)
    }
    const items: ParkedItem[] = []
    for (const pass of passes) {
      const last = latest.get(pass.id)
      if (last?.direction === 'IN') items.push({ pass, since: last.at })
    }
    return items.sort((a, b) => new Date(b.since).getTime() - new Date(a.since).getTime())
  }, [passes, scans])

  const expiring = useMemo(() => {
    const now = new Date()
    return passes
      .filter((p) => passStatus(p, now) === 'expiring')
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
  }, [passes])

  const occupancy = Math.min(100, Math.round(((parked.length + stats.walkinsToday) / Math.max(1, settings.capacity)) * 100))
  const finalStats: SiteStats = { ...stats, parked: parked.length, occupied: parked.length + stats.walkinsToday, occupancyPct: occupancy }

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      passes,
      scans,
      walkins,
      logs,
      reminders,
      parked,
      expiring,
      stats: finalStats,
      pendingCount,
      online,
      syncing,
      lastSync,
      findPass,
      scan,
      createPass,
      renewPass,
      deletePass,
      addWalkIn,
      updateSite,
      markReminder,
      runReminders,
      syncNow,
      refresh,
      reset,
      clearLogs,
    }),
    [
      ready, passes, scans, walkins, logs, reminders, parked, expiring, finalStats, pendingCount, online, syncing, lastSync,
      findPass, scan, createPass, renewPass, deletePass, addWalkIn, updateSite, markReminder, runReminders, syncNow,
      refresh, reset, clearLogs,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
