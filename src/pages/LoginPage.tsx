import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  WifiOff,
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
  { key: 'login.featureScan', icon: QrCode },
  { key: 'login.featureOffline', icon: WifiOff },
  { key: 'login.featureOwner', icon: BarChart3 },
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

  if (authenticated) {
    return <Navigate to={defaultHomeRoute(activeRole, permissions)} replace />
  }

  const describeError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return t('auth.wrongPin')
    if (err instanceof ApiError && err.status === 0) return t('common.offlineBanner')
    return err instanceof Error ? err.message : t('auth.wrongPin')
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
      setError(describeError(err))
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
      setError(describeError(err))
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
        <picture>
          <source srcSet="/images/login-bg.webp" type="image/webp" />
          <img
            src="/images/login-bg.jpg"
            alt=""
            width={1920}
            height={1097}
            decoding="async"
            className="h-full w-full object-cover object-[50%_58%] dark:opacity-60"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-[#f4f8ff]/65 via-white/35 to-[#e8f0fb]/80 dark:from-navy-950/85 dark:via-navy-950/65 dark:to-navy-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_38%,rgba(255,255,255,0.45),rgba(255,255,255,0.05)_55%,rgba(255,255,255,0.3)_100%)] dark:hidden" />
      </div>

      <div className="relative z-10 lg:grid lg:min-h-dvh lg:grid-cols-[1.05fr_minmax(440px,0.95fr)]">
        {/* Brand panel — desktop only */}
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
          <picture>
            <source srcSet="/images/login-bg.webp" type="image/webp" />
            <img
              src="/images/login-bg.jpg"
              alt=""
              width={1920}
              height={1097}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-[#071527]/90 via-[#071527]/45 to-[#0B1F3A]/15" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_20%_20%,rgba(255,255,255,0.12),transparent_60%)]" />

          <div className="relative z-10 flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl shadow-lg ring-1 ring-white/30"
            />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold tracking-tight text-white">ParkPro</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {t('app.tagline')}
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <h2 className="font-display text-[40px] font-bold leading-[1.1] tracking-tight text-white xl:text-[46px]">
              {t('login.heroTitle')}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75 xl:text-base">
              {t('login.heroSubtitle')}
            </p>
            <ul className="mt-8 space-y-3">
              {HERO_FEATURES.map((feature) => (
                <li key={feature.key} className="flex items-center gap-3 text-sm font-medium text-white/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
                    <feature.icon className="h-4 w-4 text-sky-300" aria-hidden="true" />
                  </span>
                  {t(feature.key)}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-[11px] font-medium text-white/55">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{t('auth.secureLogin')}</span>
            <span className="mx-0.5">·</span>
            <span>ParkPro 1.0.0</span>
          </div>
        </aside>

        {/* Form side */}
        <div className="relative flex min-h-dvh flex-col lg:bg-[#F7FAFF] dark:lg:bg-navy-950">
          <header className="flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:justify-end lg:px-8 lg:pt-6">
            <div className="flex items-center gap-2.5 lg:hidden">
              <img
                src="/icons/icon-192.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl shadow-sm ring-1 ring-white/80 dark:ring-white/20"
              />
              <div className="leading-tight">
                <p className="font-display text-base font-bold tracking-tight text-[#0B1F3A] dark:text-white">
                  ParkPro
                </p>
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-navy-300 min-[380px]:block">
                  {t('app.tagline')}
                </p>
              </div>
            </div>
            {languageSelect}
          </header>

          <main className="flex flex-1 items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 sm:px-6 lg:px-8 lg:py-8">
            <div className="w-full max-w-[430px] rounded-[28px] border border-white/70 bg-white/[0.82] p-5 shadow-[0_24px_70px_-24px_rgba(11,31,58,0.45)] backdrop-blur-xl sm:rounded-[30px] sm:p-7 lg:border-slate-200/70 lg:bg-white lg:shadow-[0_30px_80px_-40px_rgba(11,31,58,0.35)] dark:border-white/10 dark:bg-navy-900/85 dark:lg:bg-navy-900/70">
              <div className="mb-4">
                <h1 className="font-display text-[26px] font-bold tracking-tight text-[#0B1F3A] dark:text-white">
                  {t('auth.welcome')}
                </h1>
                <p className="mt-1 text-sm font-normal text-slate-500 dark:text-navy-300">
                  {t('auth.pinSubtitle')}
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
