import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { api, ApiError } from '@/lib/api'
import { defaultHomeRoute } from '@/lib/permissions'
import type { Lang, Role } from '@/types'
import { LANG_OPTIONS } from '@/lib/i18n'
import { vibrate, HAPTIC } from '@/lib/haptics'
import { playSound } from '@/lib/sound'

const HERO_FEATURES = [
  { label: 'Trusted Solutions', icon: ShieldCheck },
  { label: 'People First', icon: Users },
  { label: 'Growing Together', icon: TrendingUp },
] as const

export default function LoginPage() {
  const { t, settings, update, lang } = useSettings()
  const { authenticated, role: activeRole, permissions, signIn, signInDemo } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(settings.rememberDevice)
  const [busy, setBusy] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [demoEnabled, setDemoEnabled] = useState(true)

  useEffect(() => {
    let active = true
    void api
      .health()
      .then((health) => {
        if (active) setDemoEnabled(health.demoLogin)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (lockoutSeconds <= 0) return
    const timer = window.setInterval(() => {
      setLockoutSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [lockoutSeconds])

  if (authenticated) {
    return <Navigate to={defaultHomeRoute(activeRole, permissions)} replace />
  }

  const describeError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 0) return t('common.offlineBanner')
    if (err instanceof ApiError && (err.status === 401 || err.status === 423 || err.status === 429)) {
      return err.message
    }
    return err instanceof Error ? err.message : t('auth.wrongPin')
  }

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!username.trim() || !password) {
      setError(t('auth.wrongPin'))
      return
    }

    setBusy(true)
    setError('')
    try {
      await signIn(username, password, rememberMe)
      playSound('success', settings.sound)
      vibrate(HAPTIC.success, settings.haptics)
    } catch (err) {
      if (err instanceof ApiError && err.status === 423 && err.remainingSeconds) {
        setLockoutSeconds(err.remainingSeconds)
      }
      const msg = describeError(err)
      setError(
        err instanceof ApiError && err.status === 423 && err.remainingSeconds
          ? `${msg} (${formatCountdown(err.remainingSeconds)} remaining)`
          : msg,
      )
      playSound('error', settings.sound)
      vibrate(HAPTIC.error, settings.haptics)
    } finally {
      setBusy(false)
    }
  }

  const demoLogin = async (demoRole: Role) => {
    setBusy(true)
    setError('')
    try {
      await signInDemo(demoRole, rememberMe)
      playSound('success', settings.sound)
      vibrate(HAPTIC.success, settings.haptics)
    } catch (err) {
      if (err instanceof ApiError && err.status === 423 && err.remainingSeconds) {
        setLockoutSeconds(err.remainingSeconds)
      }
      const msg = describeError(err)
      setError(
        err instanceof ApiError && err.status === 423 && err.remainingSeconds
          ? `${msg} (${formatCountdown(err.remainingSeconds)} remaining)`
          : msg,
      )
      playSound('error', settings.sound)
      vibrate(HAPTIC.error, settings.haptics)
    } finally {
      setBusy(false)
    }
  }

  const languageSelect = (
    <div>
      <label className="sr-only" htmlFor="login-lang">
        {t('settings.language')}
      </label>
      <select
        id="login-lang"
        value={lang}
        onChange={(event) => update({ lang: event.target.value as Lang })}
        className="h-8 cursor-pointer rounded-full border border-white/90 bg-white/85 px-3 pr-7 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-md outline-none transition-colors focus:border-[#1868FE] dark:border-white/15 dark:bg-white/10 dark:text-white"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          appearance: 'none',
        }}
      >
        {LANG_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.native}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#EAF1FB] text-slate-900 dark:bg-navy-950 dark:text-white">
      {/* Full-page background image — mobile and tablet (desktop uses the brand panel) */}
      <div aria-hidden="true" className="fixed inset-0 z-0 lg:hidden">
        <img
          src="/images/login-bg.jpg?v=2"
          alt=""
          width={1920}
          height={1097}
          decoding="async"
          className="h-full w-full object-cover object-[50%_20%] dark:opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f4f8ff]/75 via-[#f4f8ff]/45 to-[#e8f0fb]/90 dark:from-navy-950/85 dark:via-navy-950/65 dark:to-navy-950/90" />
      </div>

      <div className="relative z-10 lg:grid lg:min-h-dvh lg:grid-cols-[1.05fr_minmax(440px,0.95fr)]">
        {/* Brand panel — desktop only */}
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
          <img
            src="/images/login-bg.jpg?v=2"
            alt=""
            width={1920}
            height={1097}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f8fbff]/92 via-[#f4f8ff]/65 to-transparent" />

          <div className="relative z-10 flex items-center">
            <img
              src="/images/poriya-logo.png"
              alt="Poriya Group"
              className="h-32 w-auto object-contain"
            />
          </div>

          <div className="relative z-10 max-w-md">
            <p className="font-display text-2xl font-medium text-slate-500 xl:text-3xl">Welcome To</p>
            <h2 className="font-display text-[40px] font-bold leading-[1.08] tracking-tight text-[#0B1F3A] xl:text-[46px]">
              Poriya Group
            </h2>
            <div className="mt-3 h-1 w-8 rounded-full bg-[#1868FE]" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 xl:text-base">
              Your trusted partner in growth, innovation and long-term success.
            </p>
            <div className="mt-7 flex items-center gap-6">
              {HERO_FEATURES.map((feature) => (
                <div key={feature.label} className="flex flex-col items-center text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1868FE] shadow-sm ring-1 ring-slate-200/80">
                    <feature.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="mt-1.5 text-[11px] font-semibold leading-tight text-[#0B1F3A]">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-sm font-medium italic text-slate-600">
            Build Today for a Better Tomorrow
          </div>
        </aside>

        {/* Form side */}
        <div className="relative flex min-h-dvh flex-col overflow-hidden lg:bg-[#F4F8FF] dark:lg:bg-navy-950">
          {/* Subtle decorative shapes on desktop form panel */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 hidden h-72 w-72 rounded-full bg-gradient-to-br from-[#1868FE]/15 to-sky-300/20 blur-2xl lg:block dark:from-[#1868FE]/10 dark:to-sky-500/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-16 hidden h-80 w-80 rounded-full bg-gradient-to-tr from-[#1868FE]/15 to-blue-200/25 blur-2xl lg:block dark:from-[#1868FE]/10 dark:to-blue-500/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-10 left-8 hidden h-20 w-20 opacity-35 lg:block dark:opacity-15"
            style={{
              backgroundImage: 'radial-gradient(#1868FE 1.5px, transparent 1.5px)',
              backgroundSize: '12px 12px',
            }}
          />
          <header className="flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:justify-end lg:px-8 lg:pt-6">
            <div className="flex items-center lg:hidden">
              <img
                src="/images/poriya-logo.png"
                alt="Poriya Group"
                className="h-24 w-auto object-contain"
              />
            </div>
            {languageSelect}
          </header>

          <main className="flex flex-1 flex-col items-center justify-center px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 sm:px-6 lg:px-8 lg:py-8">
            {/* Mobile hero — matches mobile mockup */}
            <div className="mb-3 w-full max-w-[420px] px-1 lg:hidden">
              <p className="font-display text-lg font-medium text-slate-600 dark:text-navy-200">Welcome To</p>
              <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-[#0B1F3A] dark:text-white">
                Poriya Group
              </h2>
              <div className="mt-1.5 h-0.5 w-7 rounded-full bg-[#1868FE]" />
              <p className="mt-1.5 text-xs leading-snug text-slate-600 dark:text-navy-300">
                Your trusted partner in growth, innovation and long-term success.
              </p>
              <div className="mt-2.5 flex items-center gap-4">
                {HERO_FEATURES.map((feature) => (
                  <div key={feature.label} className="flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#1868FE] shadow-sm">
                      <feature.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-semibold leading-tight text-[#0B1F3A] dark:text-white">
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-[420px] rounded-[24px] border border-white/70 bg-white/[0.92] p-4 shadow-[0_24px_70px_-24px_rgba(11,31,58,0.45)] backdrop-blur-xl sm:rounded-[30px] sm:p-7 lg:border-slate-200/70 lg:bg-white lg:shadow-[0_30px_80px_-40px_rgba(11,31,58,0.35)] dark:border-white/10 dark:bg-navy-900/85 dark:lg:bg-navy-900/70">
              <div className="mb-3 sm:mb-4">
                <h1 className="font-display text-[22px] font-bold tracking-tight text-[#0B1F3A] sm:text-[26px] dark:text-white">
                  <span className="lg:hidden">Login to Your Account</span>
                  <span className="hidden lg:inline">Welcome Back</span>
                </h1>
                <p className="mt-0.5 text-xs font-normal text-slate-500 sm:mt-1 sm:text-sm dark:text-navy-300">
                  <span className="lg:hidden">Enter your credentials to access the Poriya Group management system.</span>
                  <span className="hidden lg:inline">Login to your account to continue</span>
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-xs font-semibold text-red-700 animate-shake dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all focus-within:border-[#1868FE] focus-within:ring-2 focus-within:ring-[#1868FE]/15 dark:border-white/10 dark:bg-white/[0.06]">
                  <label htmlFor="login-username" className="sr-only">
                    {t('auth.usernamePlaceholder')}
                  </label>
                  <UserRound
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-navy-300"
                    aria-hidden="true"
                  />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder={t('auth.usernamePlaceholder')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    enterKeyHint="next"
                    className="w-full bg-transparent py-3.5 pl-12 pr-4 text-base font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 outline-none sm:text-sm dark:text-white dark:placeholder:text-navy-300"
                  />
                </div>

                <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all focus-within:border-[#1868FE] focus-within:ring-2 focus-within:ring-[#1868FE]/15 dark:border-white/10 dark:bg-white/[0.06]">
                  <label htmlFor="login-password" className="sr-only">
                    {t('auth.passwordPlaceholder')}
                  </label>
                  <Lock
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-navy-300"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    className="w-full bg-transparent py-3.5 pl-12 pr-12 text-base font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 outline-none sm:text-sm dark:text-white dark:placeholder:text-navy-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-slate-600 dark:text-navy-300 dark:hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label
                    htmlFor="login-remember"
                    className="flex cursor-pointer select-none items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-navy-100"
                  >
                    <input
                      id="login-remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-slate-300 bg-white transition-colors peer-checked:border-[#1868FE] peer-checked:bg-[#1868FE] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#1868FE]/30 peer-focus-visible:ring-offset-1 dark:border-white/20 dark:bg-white/5 dark:peer-focus-visible:ring-offset-navy-900"
                    >
                      {rememberMe && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </span>
                    <span>{t('auth.rememberMe')}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-semibold text-[#1868FE] transition-colors hover:underline dark:text-sky-400"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] text-base font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-[#155CE0] hover:to-[#246DE6] active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <span>{t('auth.signIn')}</span>
                      <ArrowRight className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5">
                {demoEnabled && (
                  <>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void demoLogin('owner')}
                        disabled={busy}
                        className="min-h-[42px] rounded-xl border border-slate-200 bg-white/80 text-xs font-semibold text-slate-700 backdrop-blur-sm transition-colors hover:border-[#1868FE]/40 hover:text-[#1868FE] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-navy-100 dark:hover:border-sky-400/40 dark:hover:text-sky-300"
                      >
                        {t('auth.ownerDemo')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void demoLogin('staff')}
                        disabled={busy}
                        className="min-h-[42px] rounded-xl border border-slate-200 bg-white/80 text-xs font-semibold text-slate-700 backdrop-blur-sm transition-colors hover:border-[#1868FE]/40 hover:text-[#1868FE] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-navy-100 dark:hover:border-sky-400/40 dark:hover:text-sky-300"
                      >
                        {t('auth.staffDemo')}
                      </button>
                    </div>

                    <div className="relative mb-3 flex items-center justify-center">
                      <div className="w-full border-t border-slate-300/60 dark:border-white/10" />
                      <span className="absolute px-1.5 text-[11px] font-medium text-slate-400 dark:text-navy-300">
                        <span className="rounded bg-white/70 px-1.5 py-0.5 backdrop-blur-sm dark:bg-navy-900/80">
                          {t('common.or')}
                        </span>
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-navy-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('auth.secureLogin')}</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-navy-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="h-5 w-5 text-[#1868FE] dark:text-sky-400" />
                <span>{t('auth.forgotTitle')}</span>
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-navy-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-navy-200">
              {t('auth.forgotBody')}
            </p>
            <div className="mt-3.5 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 dark:border-sky-400/20 dark:bg-sky-400/10">
              <p className="text-xs font-bold text-[#0B1F3A] dark:text-white">
                {t('auth.ownerLabel')}: {settings.ownerName || 'Bhavesh Porva'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-navy-300">
                {t('auth.facilityLabel')}: {settings.siteName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="mt-5 min-h-[46px] w-full rounded-2xl bg-[#1868FE] text-xs font-bold text-white transition hover:bg-blue-600"
            >
              {t('auth.understood')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
