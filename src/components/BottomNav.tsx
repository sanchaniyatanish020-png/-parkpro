import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  CarFront,
  ChevronRight,
  History,
  Home,
  LayoutGrid,
  ScanLine,
  Settings2,
  Ticket,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Avatar, Badge } from '@/components/ui'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useData } from '@/state/DataContext'
import { countGrantedPermissions, STAFF_PERMISSION_KEYS } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const GRID_COLS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6'] as const

type NavGroup = 'gate' | 'admin' | 'account'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  group: NavGroup
  badge?: number
  end?: boolean
}

export function BottomNav() {
  const { t, settings } = useSettings()
  const { role, name, permissions, can } = useAuth()
  const { pendingCount } = useData()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const owner = role === 'owner'
  const showScan = owner || can('scan')

  const pick = <T,>(value: T | null): T[] => (value ? [value] : [])

  const homeItem = can('dashboard') || can('revenue')
    ? ({ to: '/admin', icon: Home, label: t('nav.home'), end: true, group: 'admin' } as NavItem)
    : null
  const passesItem = can('passes')
    ? ({ to: '/admin/passes', icon: Ticket, label: t('nav.passes'), group: 'admin' } as NavItem)
    : null
  const reportsItem = can('reports')
    ? ({ to: '/admin/reports', icon: BarChart3, label: t('nav.reports'), group: 'admin' } as NavItem)
    : null
  const employeesItem = can('employees')
    ? ({ to: '/admin/employees', icon: Users, label: t('nav.employees'), group: 'admin' } as NavItem)
    : null
  const parkedItem = can('parked')
    ? ({ to: '/parked', icon: CarFront, label: t('nav.parked'), group: 'gate' } as NavItem)
    : null
  const walkinItem = can('walkin')
    ? ({ to: '/walk-in', icon: UserRoundPlus, label: t('nav.walkin'), group: 'gate' } as NavItem)
    : null
  const historyItem = can('history')
    ? ({
        to: '/history',
        icon: History,
        label: t('nav.history'),
        badge: owner ? undefined : pendingCount,
        group: 'gate',
      } as NavItem)
    : null
  const settingsItem: NavItem = { to: '/settings', icon: Settings2, label: t('nav.settings'), group: 'account' }

  // Owners see the console first; staff see gate operations first with newly granted rights kept high.
  const entries: NavItem[] = owner
    ? [
        ...pick(homeItem),
        ...pick(passesItem),
        ...pick(reportsItem),
        ...pick(employeesItem),
        ...pick(parkedItem),
        ...pick(walkinItem),
        ...pick(historyItem),
        settingsItem,
      ]
    : [
        ...pick(parkedItem),
        ...pick(passesItem),
        ...pick(walkinItem),
        ...pick(historyItem),
        ...pick(homeItem),
        ...pick(reportsItem),
        ...pick(employeesItem),
        settingsItem,
      ]

  const primary = entries.slice(0, 4)
  const hidden = entries.slice(4)
  const showMore = hidden.length > 0
  const totalSlots = primary.length + (showScan ? 1 : 0) + (showMore ? 1 : 0)
  const dense = totalSlots >= 6

  const splitAt = Math.ceil(primary.length / 2)
  const leftItems = showScan ? primary.slice(0, splitAt) : primary
  const rightItems = showScan ? primary.slice(splitAt) : []

  const hiddenBadge = hidden.reduce((sum, item) => sum + (item.badge ?? 0), 0)
  const matches = (item: NavItem) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
  const moreActive = moreOpen || hidden.some(matches)

  const gateMenu: NavItem[] = [
    ...(showScan ? [{ to: '/scan', icon: ScanLine, label: t('nav.scan'), group: 'gate' } as NavItem] : []),
    ...entries.filter((item) => item.group === 'gate'),
  ]
  const adminMenu = entries.filter((item) => item.group === 'admin')
  const accountMenu = entries.filter((item) => item.group === 'account')
  const displayName = name || (owner ? settings.ownerName || 'Bhavesh Porva' : settings.staffName)

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/95 lg:hidden"
      >
        <div
          className={cn(
            'mx-auto grid max-w-lg items-end px-2',
            GRID_COLS[Math.min(6, Math.max(1, totalSlots))],
          )}
        >
          {leftItems.map((item) => (
            <TabItem key={item.to} item={item} dense={dense} />
          ))}

          {showScan && (
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
          )}

          {rightItems.map((item) => (
            <TabItem key={item.to} item={item} dense={dense} />
          ))}

          {showMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                'relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1 pt-2 text-[11px] font-semibold transition-colors',
                moreActive
                  ? 'font-bold text-[#1868FE] dark:text-[#38BDF8]'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400',
              )}
            >
              <span className="relative">
                <LayoutGrid className={dense ? 'h-5 w-5' : 'h-[22px] w-[22px]'} aria-hidden="true" />
                {hiddenBadge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1868FE] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                    {hiddenBadge > 9 ? '9+' : hiddenBadge}
                  </span>
                )}
              </span>
              <span className="max-w-[68px] truncate">{t('nav.more')}</span>
              {moreActive && <span className="absolute top-0 h-0.5 w-6 rounded-full bg-[#1868FE]" aria-hidden="true" />}
            </button>
          )}
        </div>
      </nav>

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t('nav.allSections')}
        subtitle={t('nav.allSectionsHint')}
      >
        <div className="space-y-5 pb-2">
          <div className="flex items-center gap-3 rounded-2xl bg-navy-50/80 p-3.5 dark:bg-white/[0.05]">
            <Avatar name={displayName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-navy-900 dark:text-white">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-300">
                {owner ? t('auth.owner') : t('auth.gateStaff')} · {settings.siteName}
              </p>
            </div>
            <Badge tone={owner ? 'amber' : 'neutral'}>
              {owner
                ? t('settings.presetFullAccess')
                : t('settings.rightsCount', {
                    n: countGrantedPermissions(permissions),
                    total: STAFF_PERMISSION_KEYS.length,
                  })}
            </Badge>
          </div>

          {gateMenu.length > 0 && (
            <MoreGroup title={t('nav.groupGate')} items={gateMenu} onNavigate={() => setMoreOpen(false)} />
          )}
          {adminMenu.length > 0 && (
            <MoreGroup title={t('nav.groupAdmin')} items={adminMenu} onNavigate={() => setMoreOpen(false)} />
          )}
          {accountMenu.length > 0 && (
            <MoreGroup title={t('nav.account')} items={accountMenu} onNavigate={() => setMoreOpen(false)} />
          )}
        </div>
      </Sheet>
    </>
  )
}

function MoreGroup({
  title,
  items,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  onNavigate: () => void
}) {
  return (
    <section aria-label={title}>
      <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
        {title}
      </p>
      <div className="divide-y divide-navy-100 overflow-hidden rounded-2xl border border-navy-100 dark:divide-white/10 dark:border-white/10">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] items-center gap-3 px-3.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-blue-50/80 text-[#1868FE] dark:bg-blue-500/10 dark:text-blue-300'
                    : 'text-navy-800 hover:bg-navy-50/70 dark:text-navy-100 dark:hover:bg-white/[0.04]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isActive
                        ? 'bg-[#1868FE] text-white'
                        : 'bg-navy-50 text-navy-500 dark:bg-white/[0.06] dark:text-navy-200',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-[#1868FE] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {item.badge}
                    </span>
                  ) : null}
                  <ChevronRight
                    className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#1868FE] dark:text-blue-300' : 'text-navy-300')}
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </section>
  )
}

function TabItem({ item, dense }: { item: NavItem; dense: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1 pt-2 text-[11px] font-semibold transition-colors',
          isActive ? 'font-bold text-[#1868FE] dark:text-[#38BDF8]' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon className={cn(dense ? 'h-5 w-5' : 'h-[22px] w-[22px]', isActive && 'stroke-[2.4]')} aria-hidden="true" />
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
