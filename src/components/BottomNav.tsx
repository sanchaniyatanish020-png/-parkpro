import { NavLink } from 'react-router-dom'
import { BarChart3, CarFront, History, Home, ScanLine, ScrollText, Settings2, Ticket, UserRoundPlus } from 'lucide-react'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useData } from '@/state/DataContext'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const { t } = useSettings()
  const { role } = useAuth()
  const { pendingCount } = useData()

  const staffItems = [
    { to: '/parked', icon: CarFront, label: t('nav.parked') },
    { to: '/walk-in', icon: UserRoundPlus, label: t('nav.walkin') },
    { to: '/history', icon: History, label: t('nav.history'), badge: pendingCount },
    { to: '/settings', icon: Settings2, label: t('nav.settings') },
  ]

  const ownerItems = [
    { to: '/admin', icon: Home, label: t('nav.home'), end: true },
    { to: '/admin/passes', icon: Ticket, label: t('nav.passes') },
    { to: '/admin/reports', icon: BarChart3, label: t('nav.reports') },
    { to: '/admin/logs', icon: ScrollText, label: t('nav.logs'), badge: pendingCount },
  ]

  const items = role === 'owner' ? ownerItems : staffItems

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/95 lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
        <TabItem item={items[0]} />
        <TabItem item={items[1]} />

        <NavLink
          to="/scan"
          aria-label={t('scan.title')}
          className="-mt-7 flex flex-col items-center gap-1 pb-1 focus-visible:rounded-2xl"
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'flex h-[62px] w-[62px] items-center justify-center rounded-full bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] text-white shadow-lg shadow-blue-500/35 ring-4 ring-white transition-transform active:scale-95 dark:ring-navy-950',
                  isActive && 'ring-blue-200 dark:ring-blue-500/40',
                )}
              >
                <ScanLine className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-bold text-navy-800 dark:text-navy-100">{t('nav.scan')}</span>
            </>
          )}
        </NavLink>

        <TabItem item={items[2]} />
        <TabItem item={items[3]} />
      </div>
    </nav>
  )
}

function TabItem({
  item,
}: {
  item: { to: string; icon: typeof Home; label: string; badge?: number; end?: boolean }
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[58px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1 pt-2 text-[11px] font-semibold transition-colors',
          isActive ? 'text-[#1868FE] dark:text-[#38BDF8] font-bold' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon className={cn('h-[22px] w-[22px]', isActive && 'stroke-[2.4]')} aria-hidden="true" />
            {item.badge ? (
              <span
                className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1868FE] px-1 text-[10px] font-bold leading-none text-white shadow-sm"
                aria-label={`${item.badge} pending`}
              >
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
          </span>
          <span className="max-w-[68px] truncate">{item.label}</span>
          {isActive && <span className="absolute top-0 h-0.5 w-6 rounded-full bg-[#1868FE]" aria-hidden="true" />}
        </>
      )}
    </NavLink>
  )
}
