import { useEffect, useState } from 'react'
import { Eye, EyeOff, Fingerprint, LockKeyhole, LogOut, ShieldAlert } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { biometricAvailable } from '@/lib/biometric'
import { vibrate, HAPTIC } from '@/lib/haptics'
import { playSound } from '@/lib/sound'

export function LockScreen() {
  const { locked, unlock, unlockBiometric, signOut, username, role } = useAuth()
  const { t, settings } = useSettings()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [bio, setBio] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void biometricAvailable().then(setBio)
  }, [])

  useEffect(() => {
    if (!locked) {
      setPassword('')
      setShowPassword(false)
      setError('')
    }
  }, [locked])

  if (!locked) return null

  const handleUnlock = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!password) return

    if (unlock(password)) {
      setPassword('')
      setError('')
      playSound('success', settings.sound)
      vibrate(HAPTIC.success, settings.haptics)
    } else {
      setError(t('auth.wrongPin'))
      setPassword('')
      playSound('error', settings.sound)
      vibrate(HAPTIC.error, settings.haptics)
    }
  }

  const tryBiometric = async () => {
    setBusy(true)
    const ok = await unlockBiometric()
    setBusy(false)
    if (!ok) setError(t('auth.biometricFailed'))
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col mesh-navy px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),24px)] text-white">
      <div className="flex items-center justify-between">
        <Logo size={32} wordmarkClass="text-white text-lg" />
        <button
          type="button"
          onClick={signOut}
          className="flex min-h-[48px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-navy-200 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('action.signOut')}
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-6">
        <div className="mb-4 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/15 bg-white/[0.07] text-[#38BDF8]">
            <LockKeyhole className="h-8 w-8" aria-hidden="true" />
          </span>
        </div>

        <h1 className="text-center font-display text-2xl font-semibold">{t('auth.lockedTitle')}</h1>
        <p className="mt-1 text-center text-sm text-navy-200">{t('auth.lockedSubtitle')}</p>

        <div className="mt-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-blue-300">
            {role === 'owner' ? t('auth.owner') : t('auth.gateStaff')}: {username}
          </span>
        </div>

        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-danger/15 border border-danger/30 px-3.5 py-2.5 text-xs font-medium text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
              placeholder={t('auth.passwordPlaceholder')}
              autoFocus
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 pr-11 text-base font-semibold text-white placeholder-navy-300 outline-none transition focus:border-[#1868FE] focus:bg-white/[0.14]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-navy-300 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <Button type="submit" full className="min-h-[50px] text-base font-bold shadow-lg">
            {t('auth.unlock')}
          </Button>

          {bio && (
            <button
              type="button"
              onClick={() => void tryBiometric()}
              disabled={busy}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-sm font-semibold text-navy-100 hover:bg-white/10 disabled:opacity-50"
            >
              <Fingerprint className="h-5 w-5 text-[#38BDF8]" aria-hidden="true" />
              {t('auth.biometric')}
            </button>
          )}
        </form>
      </div>

      <p className="text-center text-xs text-navy-400">{t('auth.sessionEnded')}</p>
    </div>
  )
}
