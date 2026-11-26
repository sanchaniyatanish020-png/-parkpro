import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { CloudOff } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { Sidebar } from '@/components/Sidebar'
import { LockScreen } from '@/components/LockScreen'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useData } from '@/state/DataContext'
import { Skeleton } from '@/components/ui'

function PageFallback() {
  return (
    <div className="px-page py-5">
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export function AppShell() {
  const { authenticated, locked } = useAuth()
  const { t } = useSettings()
  const { online, pendingCount } = useData()
  const location = useLocation()

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const immersive = location.pathname === '/scan'

  if (immersive) {
    return locked ? (
      <LockScreen />
    ) : (
      <Suspense fallback={<div className="min-h-dvh mesh-navy" />}>
        <Outlet />
      </Suspense>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas dark:bg-navy-950">
      <Sidebar />
      <div className="lg:pl-[268px]">
        <Header />
        {!online && (
          <div className="flex items-center gap-2 bg-amber-100 px-4 py-2.5 text-xs font-semibold text-[#7C4A00] dark:bg-amber-500/15 dark:text-amber-200">
            <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t('common.offlineBanner')}</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-navy-900">
                {pendingCount}
              </span>
            )}
          </div>
        )}

        <main
          className={`min-h-[calc(100dvh-58px)] pb-nav lg:pb-10 ${locked ? 'pointer-events-none select-none' : ''}`}
          aria-hidden={locked || undefined}
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>

        <BottomNav />
      </div>
      {locked && <LockScreen />}
    </div>
  )
}
