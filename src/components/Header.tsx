import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, CloudOff, RefreshCw, Shield, UserRound, Wifi } from 'lucide-react'
import { useSettings } from '@/state/SettingsContext'
import { useAuth } from '@/state/AuthContext'
import { useData } from '@/state/DataContext'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'

const TITLES: { match: RegExp; key: string }[] = [
  { match: /^\/admin\/passes\/[^/]+$/, key: 'passes.detail' },
  { match: /^\/admin\/passes$/, key: 'passes.title' },
  { match: /^\/admin\/reports$/, key: 'reports.title' },
  { match: /^\/admin\/logs$/, key: 'logs.title' },
  { match: /^\/admin$/, key: 'nav.home' },
  { match: /^\/parked$/, key: 'parked.title' },
  { match: /^\/walk-in$/, key: 'walkin.title' },
  { match: /^\/history$/, key: 'history.title' },
  { match: /^\/settings$/, key: 'settings.title' },
]

export function Header() {
  const { t, settings } = useSettings()
  const { role } = useAuth()
  const { online, pendingCount, syncNow, syncing } = useData()
  const location = useLocation()
  const navigate = useNavigate()

  const titleKey = TITLES.find((entry) => entry.match.test(location.pathname))?.key ?? 'nav.home'
  const canGoBack = /^\/admin\/passes\/[^/]+$/.test(location.pathname)

  return (
    <header className="sticky top-0 z-30 border-b border-navy-100/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/85">
      <div className="flex h-[58px] items-center gap-2 px-4">
        {canGoBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('action.back')}
            className="icon-btn -ml-1 border-transparent bg-transparent dark:bg-transparent"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold text-navy-900 dark:text-white">
          {t(titleKey)}
        </h1>

        <div className="hidden lg:flex items-center gap-2 mr-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-200/60 bg-navy-50/80 px-3 py-1 text-xs font-semibold text-navy-700 dark:border-white/10 dark:bg-white/5 dark:text-navy-200">
            <Building2 className="h-3.5 w-3.5 text-[#1868FE]" aria-hidden="true" />
            <span>{settings.siteName}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:border-blue-400/20 dark:text-blue-300">
            {role === 'owner' ? (
              <Shield className="h-3 w-3 text-[#1868FE]" aria-hidden="true" />
            ) : (
              <UserRound className="h-3 w-3 text-blue-600" aria-hidden="true" />
            )}
            <span>{role === 'owner' ? t('auth.owner') : t('auth.gateStaff')}</span>
          </span>
        </div>

        {online ? (
          <button
            type="button"
            onClick={() => (pendingCount > 0 ? void syncNow(true) : undefined)}
            aria-label={pendingCount > 0 ? `${t('common.pendingSync')} ${pendingCount}` : t('common.online')}
            className="flex min-h-[48px] items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 text-xs font-bold text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]"
          >
            {syncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden xs:inline">{t('common.online')}</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-[#15803D] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ) : (
          <span className="flex min-h-[48px] items-center gap-1.5 rounded-full bg-[#FFEDD5] px-2.5 text-xs font-bold text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]">
            <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
            {t('common.offline')}
          </span>
        )}

        <Link
          to="/settings"
          aria-label={t('settings.title')}
          className={cn('ml-0.5 flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95')}
        >
          <Avatar name={role === 'owner' ? (settings.ownerName || 'Bhavesh Porva') : settings.staffName} size="md" />
        </Link>
      </div>
    </header>
  )
}
