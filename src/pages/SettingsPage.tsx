import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  ChevronRight,
  CloudOff,
  Fingerprint,
  KeyRound,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Type,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { ThemeMode } from '@/types'
import { useAuth } from '@/state/AuthContext'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Badge, Button, Segmented, SelectInput, TextInput, Toggle } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { LANG_OPTIONS } from '@/lib/i18n'
import { biometricAvailable, enrollBiometric, forgetBiometric, hasBiometricEnrolled } from '@/lib/biometric'
import {
  notificationPermission,
  requestNotificationPermission,
  showLocalNotification,
} from '@/lib/notifications'
import { formatDateTime } from '@/lib/utils'

const AUTO_LOCK = [
  { value: 0, key: 'settings.autoLockOff' },
  { value: 5, key: 'settings.autoLock5' },
  { value: 10, key: 'settings.autoLock10' },
  { value: 15, key: 'settings.autoLock15' },
  { value: 30, key: 'settings.autoLock30' },
]

export default function SettingsPage() {
  const { settings, update, t, lang } = useSettings()
  const { role, signOut, changePassword } = useAuth()
  const { stats, pendingCount, lastSync, online, syncing, syncNow, reset, updateSite } = useData()
  const { toast } = useToast()
  const navigate = useNavigate()
  const isOwner = role === 'owner'

  const [permission, setPermission] = useState(() => notificationPermission())
  const [bioReady, setBioReady] = useState(false)
  const [bioEnrolled, setBioEnrolled] = useState(() => hasBiometricEnrolled(role))
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    void biometricAvailable().then(setBioReady)
  }, [])

  useEffect(() => {
    const sync = () => setPermission(notificationPermission())
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  const notifToggle = (key: keyof typeof settings.notifications, value: boolean) => {
    update({ notifications: { ...settings.notifications, [key]: value } })
  }

  const enableNotifications = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === 'granted') toast({ message: t('settings.notifsOn'), tone: 'success' })
    else if (result === 'unsupported') toast({ message: t('settings.notifsUnsupported'), tone: 'warning' })
    else toast({ message: t('settings.notifsBlocked'), tone: 'warning' })
  }

  const testNotification = async () => {
    await showLocalNotification(t('notif.testTitle'), t('notif.testBody'), 'parkpro-test')
    toast({ message: t('settings.testNotifSent'), tone: 'success' })
  }

  const handleBiometric = async (value: boolean) => {
    if (!value) {
      forgetBiometric(role)
      setBioEnrolled(false)
      return
    }
    const ok = await enrollBiometric(role)
    if (ok) {
      setBioEnrolled(true)
      toast({ message: t('settings.biometric'), tone: 'success' })
    } else {
      toast({ message: t('auth.biometricUnavailable'), tone: 'warning' })
    }
  }

  const openChangePin = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordOpen(true)
  }

  const handleChangePin = async () => {
    setPasswordError('')
    if (!currentPassword) {
      setPasswordError(t('settings.pinWrong'))
      return
    }
    if (newPassword.trim().length < 8) {
      setPasswordError(t('settings.pinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.pinMismatch'))
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast({ message: t('settings.pinChanged'), tone: 'success' })
      setPasswordOpen(false)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('settings.pinWrong'))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await reset()
      setResetOpen(false)
    } finally {
      setResetting(false)
    }
  }

  const handleSignOut = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  const permissionBadge =
    permission === 'granted' ? (
      <Badge tone="success" icon={Check}>
        {t('settings.notifsOn')}
      </Badge>
    ) : permission === 'denied' ? (
      <Badge tone="danger" icon={WifiOff}>
        {t('common.offline')}
      </Badge>
    ) : permission === 'unsupported' ? (
      <Badge tone="neutral">{t('settings.notifsUnsupported')}</Badge>
    ) : (
      <Badge tone="warning" icon={Bell}>
        {t('action.enable')}
      </Badge>
    )

  return (
    <div className="px-page py-4 lg:mx-auto lg:max-w-2xl lg:py-7">
      <div className="flex items-center gap-3 rounded-2xl bg-navy-900 p-4 text-white dark:bg-white/[0.06]">
        <Avatar name={role === 'owner' ? (settings.ownerName || 'Bhavesh Porva') : settings.staffName} size="lg" className="bg-white/10 text-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">{role === 'owner' ? (settings.ownerName || 'Bhavesh Porva') : settings.staffName}</p>
          <p className="text-xs text-navy-300">
            {role === 'owner' ? t('auth.owner') : t('auth.gateStaff')} · {settings.siteName}
          </p>
        </div>
        <Badge tone="amber">{role === 'owner' ? t('panel.admin') : t('panel.scanner')}</Badge>
      </div>

      <Group title={t('settings.profile')} icon={UserRound}>
        <div className="py-3">
          <TextInput
            label={role === 'owner' ? t('auth.owner') : t('settings.yourName')}
            value={role === 'owner' ? (settings.ownerName || 'Bhavesh Porva') : settings.staffName}
            onChange={(event) => update(role === 'owner' ? { ownerName: event.target.value } : { staffName: event.target.value })}
            autoComplete="name"
          />
        </div>
        <div className="py-3">
          <TextInput
            label={t('settings.siteName')}
            value={settings.siteName}
            onChange={(event) => update({ siteName: event.target.value })}
            onBlur={isOwner ? () => void updateSite({ name: settings.siteName }) : undefined}
            disabled={!isOwner}
          />
        </div>
        <div className="pb-3 pt-1">
          <TextInput
            label={t('settings.capacity')}
            type="number"
            inputMode="numeric"
            min={1}
            value={String(settings.capacity)}
            onChange={(event) => update({ capacity: Math.max(1, Number(event.target.value) || 1) })}
            onBlur={isOwner ? () => void updateSite({ capacity: settings.capacity }) : undefined}
            hint={isOwner ? t('settings.capacityHelp') : undefined}
            disabled={!isOwner}
          />
        </div>
      </Group>

      <Group title={t('settings.appearance')} icon={Palette}>
        <div className="py-3">
          <p className="label">{t('settings.theme')}</p>
          <Segmented<ThemeMode>
            ariaLabel={t('settings.theme')}
            value={settings.theme}
            onChange={(value) => update({ theme: value })}
            options={[
              { id: 'system', label: t('settings.themeSystem'), icon: Monitor },
              { id: 'light', label: t('settings.themeLight'), icon: Sun },
              { id: 'dark', label: t('settings.themeDark'), icon: Moon },
            ]}
          />
          <p className="mt-1.5 text-xs text-navy-400 dark:text-navy-300">{t('settings.appearanceHelp')}</p>
        </div>
        <div className="py-1">
          <SelectInput
            label={t('settings.language')}
            value={lang}
            onChange={(event) => update({ lang: event.target.value as typeof lang })}
          >
            {LANG_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.native}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="py-3">
          <p className="label flex items-center gap-1.5">
            <Type className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {t('settings.textSize')}
          </p>
          <Segmented
            ariaLabel={t('settings.textSize')}
            value={String(settings.fontScale)}
            onChange={(value) => update({ fontScale: Number(value) })}
            options={[
              { id: '1', label: '100%' },
              { id: '1.1', label: '110%' },
              { id: '1.25', label: '125%' },
            ]}
          />
          <p className="mt-1.5 text-xs text-navy-400 dark:text-navy-300">{t('settings.textSizeHelp')}</p>
        </div>
        <Toggle
          checked={settings.sound}
          onChange={(value) => update({ sound: value })}
          label={t('settings.sound')}
          description={t('settings.soundDesc')}
        />
        <div className="pb-1">
          <Toggle
            checked={settings.haptics}
            onChange={(value) => update({ haptics: value })}
            label={t('settings.haptics')}
            description={t('settings.hapticsDesc')}
          />
        </div>
      </Group>

      <Group id="notifications" title={t('settings.notifications')} icon={Bell}>
        <div className="flex flex-wrap items-center gap-2 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900 dark:text-white">{t('settings.notifications')}</p>
            <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">
              {permission === 'denied' ? t('settings.notifsBlocked') : t('settings.notifPermission')}
            </p>
          </div>
          {permissionBadge}
        </div>

        <div>
          <Toggle
            checked={settings.notifications.expiring}
            onChange={(value) => notifToggle('expiring', value)}
            label={t('settings.notifExpiring')}
            description={t('settings.notifExpiringDesc')}
          />
          <Toggle
            checked={settings.notifications.nearlyFull}
            onChange={(value) => notifToggle('nearlyFull', value)}
            label={t('settings.notifNearlyFull')}
            description={t('settings.notifNearlyFullDesc')}
          />
          <Toggle
            checked={settings.notifications.overstay}
            onChange={(value) => notifToggle('overstay', value)}
            label={t('settings.notifOverstay')}
            description={t('settings.notifOverstayDesc')}
          />
        </div>

        <div className="space-y-2 py-3">
          {permission !== 'granted' && permission !== 'unsupported' && (
            <Button full variant="navy" icon={Bell} onClick={() => void enableNotifications()} className="min-h-[48px]">
              {t('settings.enableNotifs')}
            </Button>
          )}
          {permission === 'granted' && (
            <Button full variant="ghost" icon={Bell} onClick={() => void testNotification()} className="min-h-[48px]">
              {t('settings.testNotif')}
            </Button>
          )}
          <p className="text-xs leading-relaxed text-navy-400 dark:text-navy-300">{t('settings.notifsHint')}</p>
        </div>
      </Group>

      <Group title={t('settings.security')} icon={ShieldCheck}>
        <div className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900 dark:text-white">{t('settings.changePin')}</p>
            <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">{t('settings.passwordDesc')}</p>
          </div>
          <Button variant="ghost" icon={KeyRound} onClick={openChangePin} className="min-h-[44px] shrink-0 px-3 text-xs">
            {t('action.edit')}
          </Button>
        </div>

        <div className="py-2">
          <SelectInput
            label={t('settings.autoLock')}
            value={String(settings.autoLockMin)}
            onChange={(event) => update({ autoLockMin: Number(event.target.value) })}
          >
            {AUTO_LOCK.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </SelectInput>
        </div>

        <div>
          <Toggle
            checked={settings.rememberDevice}
            onChange={(value) => update({ rememberDevice: value })}
            label={t('settings.remember')}
            description={t('settings.rememberDesc')}
          />
          <Toggle
            checked={bioEnrolled}
            onChange={(value) => void handleBiometric(value)}
            disabled={!bioReady}
            label={t('settings.biometric')}
            description={bioReady ? t('settings.biometricDesc') : t('settings.biometricNotAvailable')}
          />
        </div>
        <div className="flex items-center gap-2 py-2.5 text-[11px] text-navy-400 dark:text-navy-300">
          <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
          {t('settings.biometricNotAvailable')}
        </div>
      </Group>

      <Group title={t('settings.offline')} icon={CloudOff}>
        <div className="grid grid-cols-3 gap-2 py-3">
          <div className="rounded-xl bg-navy-50 p-2.5 text-center dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-400 dark:text-navy-300">
              {t('settings.cachedPasses')}
            </p>
            <p className="mt-0.5 font-mono text-base font-semibold text-navy-900 dark:text-white">{stats.totalPasses}</p>
          </div>
          <div className="rounded-xl bg-navy-50 p-2.5 text-center dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-400 dark:text-navy-300">
              {t('settings.pendingQueue')}
            </p>
            <p className="mt-0.5 font-mono text-base font-semibold text-[#9A3412] dark:text-[#FDBA74]">{pendingCount}</p>
          </div>
          <div className="rounded-xl bg-navy-50 p-2.5 text-center dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-400 dark:text-navy-300">
              {t('settings.lastSync')}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-navy-900 dark:text-white">
              {lastSync ? formatDateTime(lastSync, lang) : '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 py-3">
          <span
            className={
              online
                ? 'inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-bold text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]'
                : 'inline-flex items-center gap-1.5 rounded-full bg-[#FFEDD5] px-2.5 py-1 text-xs font-bold text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]'
            }
          >
            {online ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {online ? t('settings.readyOffline') : t('common.offline')}
          </span>
          <span className="ml-auto text-[11px] text-navy-400 dark:text-navy-300">
            {t('settings.pendingQueue')}: <span className="font-mono font-semibold">{pendingCount}</span>
          </span>
        </div>

        <div className="py-2">
          <Button
            full
            variant="ghost"
            icon={RefreshCw}
            loading={syncing}
            disabled={!online}
            onClick={() => void syncNow(true)}
            className="min-h-[48px]"
          >
            {t('action.syncNow')}
          </Button>
        </div>

        <div>
          <Toggle
            checked={settings.simulateOffline}
            onChange={(value) => update({ simulateOffline: value })}
            label={t('settings.simulateOffline')}
            description={t('settings.simulateOfflineDesc')}
          />
        </div>
        <p className="pb-3 pt-1 text-xs leading-relaxed text-navy-400 dark:text-navy-300">{t('settings.syncHint')}</p>
      </Group>

      <Group title={t('settings.data')} icon={Smartphone}>
        {isOwner && (
          <div className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-white">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-900 dark:text-white">{t('settings.reset')}</p>
              <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">{t('settings.resetDesc')}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setResetOpen(true)}
              className="min-h-[44px] shrink-0 px-3.5 text-xs text-[#B91C1C] dark:text-[#FCA5A5]"
            >
              {t('settings.reset')}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between py-3 text-xs">
          <span className="text-navy-500 dark:text-navy-300">{t('settings.version')}</span>
          <span className="font-mono font-semibold text-navy-900 dark:text-white">1.0.0</span>
        </div>
      </Group>

      <Group title={t('settings.role')} icon={Languages}>
        <div className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900 dark:text-white">
              {role === 'owner' ? t('auth.owner') : t('auth.gateStaff')}
            </p>
            <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">{settings.siteName}</p>
          </div>
          {role === 'owner' ? (
            <Link
              to="/parked"
              className="flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-xs font-bold text-amber-700 dark:text-amber-400"
            >
              {t('settings.gateScanner')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              to="/login"
              onClick={signOut}
              className="flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-xs font-bold text-amber-700 dark:text-amber-400"
            >
              {t('settings.switchPanel')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="py-3">
          <Button
            full
            variant="ghost"
            icon={LogOut}
            onClick={handleSignOut}
            className="min-h-[48px] text-[#B91C1C] dark:text-[#FCA5A5]"
          >
            {t('settings.signOut')}
          </Button>
        </div>
      </Group>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-navy-400 dark:text-navy-300">
        ParkPro 1.0.0 · {t('app.tagline')}
        <br />
        {t('logs.localNote')}
      </p>

      <Sheet
        open={passwordOpen}
        onClose={() => (savingPassword ? undefined : setPasswordOpen(false))}
        title={t('settings.changePin')}
        subtitle={t('settings.passwordDesc')}
        footer={
          <Button full loading={savingPassword} onClick={() => void handleChangePin()} icon={KeyRound} className="min-h-[52px]">
            {t('action.save')}
          </Button>
        }
      >
        <div className="space-y-4">
          {passwordError && (
            <p className="rounded-xl bg-[#FEF2F2] px-3.5 py-2.5 text-sm font-medium text-[#991B1B] dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
              {passwordError}
            </p>
          )}
          <TextInput
            label={t('settings.currentPin')}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextInput
            label={t('settings.newPin')}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextInput
            label={t('settings.confirmPin')}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
      </Sheet>

      <Sheet
        open={resetOpen}
        onClose={() => (resetting ? undefined : setResetOpen(false))}
        title={t('settings.reset')}
        subtitle={t('settings.resetDesc')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" full onClick={() => setResetOpen(false)} disabled={resetting} className="min-h-[48px]">
              {t('action.cancel')}
            </Button>
            <Button variant="danger" full loading={resetting} onClick={() => void handleReset()} className="min-h-[48px]">
              {t('action.confirm')}
            </Button>
          </div>
        }
      >
        <p className="rounded-2xl bg-[#FEF2F2] p-4 text-sm text-[#991B1B] dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
          {t('settings.resetConfirm')}
        </p>
      </Sheet>
    </div>
  )
}

function Group({
  title,
  icon: Icon,
  id,
  children,
}: {
  title: string
  icon: typeof Bell
  id?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mt-4 scroll-mt-24" aria-label={title}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-navy-500 dark:text-navy-300">{title}</h2>
      </div>
      <div className="surface divide-y divide-navy-100 px-4 dark:divide-white/10">{children}</div>
    </section>
  )
}
