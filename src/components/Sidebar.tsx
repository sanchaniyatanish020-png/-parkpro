import { NavLink } from 'react-router-dom'
import { BarChart3, CarFront, History, Home, LogOut, ScanLine, Settings2, Ticket, UserRoundPlus, Users, Wifi, CloudOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar } from '@/components/ui'
import { useSettings } from '@/state/SettingsContext'
import { useAuth } from '@/state/AuthContext'
import { useData } from '@/state/DataContext'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  badge?: number
}

export function Sidebar() {
  const { t, settings } = useSettings()
  const { role, can, signOut } = useAuth()
  const { online, pendingCount, syncNow, syncing, stats } = useData()

  const adminRaw: (NavItem | null)[] = [
    can('dashboard') || can('revenue') ? { to: '/admin', icon: Home, label: t('nav.home'), end: true } : null,
    can('passes') ? { to: '/admin/passes', icon: Ticket, label: t('nav.passes') } : null,
    can('reports') ? { to: '/admin/reports', icon: BarChart3, label: t('nav.reports') } : null,
    can('employees') ? { to: '/admin/employees', icon: Users, label: t('nav.employees') } : null,
  ]
  const adminNav = adminRaw.filter((item): item is NavItem => item !== null)

  const gateRaw: (NavItem | null)[] = [
    can('scan') ? { to: '/scan', icon: ScanLine, label: t('nav.scan') } : null,
    can('parked') ? { to: '/parked', icon: CarFront, label: t('nav.parked') } : null,
    can('walkin') ? { to: '/walk-in', icon: UserRoundPlus, label: t('nav.walkin') } : null,
    can('history')
      ? { to: '/history', icon: History, label: t('nav.history'), badge: role === 'owner' ? undefined : pendingCount }
      : null,
  ]
  const gateNav = gateRaw.filter((item): item is NavItem => item !== null)

  const staffPrimary = gateNav.length > 0 ? gateNav : adminNav
  const staffSecondary = gateNav.length > 0 ? adminNav : []

  const main = role === 'owner' ? adminNav : staffPrimary
  const mainLabel = role === 'owner' || gateNav.length === 0 ? t('panel.admin') : t('panel.scanner')
  const secondary = role === 'owner' ? gateNav : staffSecondary
  const secondaryLabel = role === 'owner' ? t('panel.scanner') : t('panel.admin')

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col mesh-navy text-white lg:flex">
      <div className="flex h-[76px] shrink-0 items-center px-5">
        <Logo size={34} invert wordmarkClass="text-white text-xl" />
      </div>

      {main.length > 0 && (
        <>
          <div className="px-5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-300">
            {mainLabel}
          </div>
          <nav aria-label="Main" className="space-y-1 px-3">
            {main.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </nav>
        </>
      )}

      {secondary.length > 0 && (
        <>
          <div className="px-5 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-300">
            {secondaryLabel}
          </div>
          <nav aria-label="Additional tools" className="space-y-1 px-3">
            {secondary.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </nav>
        </>
      )}

      <div className="mt-auto space-y-3 px-3 pb-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-navy-100">
              {online ? t('settings.readyOffline') : t('common.offline')}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold">
              {online ? <Wifi className="h-3.5 w-3.5 text-[#86EFAC]" /> : <CloudOff className="h-3.5 w-3.5 text-amber-400" />}
              <span className={online ? 'text-[#86EFAC]' : 'text-amber-400'}>{online ? t('common.online') : t('common.offline')}</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-navy-300">
            <span>
              {t('settings.cachedPasses')}: <span className="font-mono text-white">{stats.totalPasses}</span>
            </span>
            <span>
              {t('settings.pendingQueue')}: <span className="font-mono text-white">{pendingCount}</span>
            </span>
          </div>
          {pendingCount > 0 && online && (
            <button
              type="button"
              onClick={() => void syncNow(true)}
              disabled={syncing}
              className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-[#1868FE] text-xs font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              {syncing ? t('history.syncing', { n: pendingCount }) : t('action.syncNow')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <Avatar name={role === 'owner' ? (settings.ownerName || 'Bhavesh Porva') : settings.staffName} size="md" className="bg-white/10 text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{role === 'owner' ? (settings.ownerName || 'Bhavesh Porva') : settings.staffName}</p>
            <p className="text-[11px] text-navy-300">{role === 'owner' ? t('auth.owner') : t('auth.gateStaff')}</p>
          </div>
          <NavLink
            to="/settings"
            aria-label={t('settings.title')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-200 hover:bg-white/10 hover:text-white"
          >
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </NavLink>
          <button
            type="button"
            onClick={signOut}
            aria-label={t('action.signOut')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-200 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
          isActive
            ? 'bg-white/12 text-white shadow-[inset_3px_0_0_0_#1868FE]'
            : 'text-navy-200 hover:bg-white/[0.06] hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-[#38BDF8]' : 'text-navy-300')} aria-hidden="true" />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-[#1868FE] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}
