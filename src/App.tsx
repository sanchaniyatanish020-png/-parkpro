import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/state/AuthContext'
import { DataProvider } from '@/state/DataContext'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const ScanPage = lazy(() => import('@/pages/ScanPage'))
const ParkedPage = lazy(() => import('@/pages/ParkedPage'))
const WalkInPage = lazy(() => import('@/pages/WalkInPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AdminHome = lazy(() => import('@/pages/AdminHome'))
const PassesPage = lazy(() => import('@/pages/PassesPage'))
const PassDetailPage = lazy(() => import('@/pages/PassDetailPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const LogsPage = lazy(() => import('@/pages/LogsPage'))

function BootSplash() {
  return (
    <div className="mesh-navy flex min-h-dvh flex-col items-center justify-center gap-4 text-white">
      <Logo size={56} wordmarkClass="text-white text-[28px]" />
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15" aria-label="Loading">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-amber-500" />
      </span>
    </div>
  )
}

function RootRedirect() {
  const { authenticated, role } = useAuth()
  if (!authenticated) return <Navigate to="/login" replace />
  return <Navigate to={role === 'owner' ? '/admin' : '/parked'} replace />
}

function OwnerOnly({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const location = useLocation()
  if (role !== 'owner') {
    return <Navigate to="/parked" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<BootSplash />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <DataProvider>
              <AppShell />
            </DataProvider>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/parked" element={<ParkedPage />} />
          <Route path="/walk-in" element={<WalkInPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/admin"
            element={
              <OwnerOnly>
                <AdminHome />
              </OwnerOnly>
            }
          />
          <Route
            path="/admin/passes"
            element={
              <OwnerOnly>
                <PassesPage />
              </OwnerOnly>
            }
          />
          <Route
            path="/admin/passes/:id"
            element={
              <OwnerOnly>
                <PassDetailPage />
              </OwnerOnly>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <OwnerOnly>
                <ReportsPage />
              </OwnerOnly>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <OwnerOnly>
                <LogsPage />
              </OwnerOnly>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
