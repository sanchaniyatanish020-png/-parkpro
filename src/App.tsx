import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { StaffPermissionKey } from '@/types'
import { defaultHomeRoute } from '@/lib/permissions'
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
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage'))

function BootSplash() {
  return (
    <div className="mesh-navy flex min-h-dvh flex-col items-center justify-center gap-4 text-white">
      <Logo size={56} invert wordmarkClass="text-white text-[28px]" />
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15" aria-label="Loading">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-amber-500" />
      </span>
    </div>
  )
}

function RootRedirect() {
  const { authenticated, role, permissions } = useAuth()
  if (!authenticated) return <Navigate to="/login" replace />
  return <Navigate to={defaultHomeRoute(role, permissions)} replace />
}

function RequirePermission({
  permission,
  children,
}: {
  permission: StaffPermissionKey | StaffPermissionKey[]
  children: ReactNode
}) {
  const { role, permissions, can } = useAuth()
  const location = useLocation()
  const allowed = Array.isArray(permission) ? permission.some((perm) => can(perm)) : can(permission)
  if (!allowed) {
    return <Navigate to={defaultHomeRoute(role, permissions)} replace state={{ from: location.pathname }} />
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
          <Route
            path="/scan"
            element={
              <RequirePermission permission="scan">
                <ScanPage />
              </RequirePermission>
            }
          />
          <Route
            path="/parked"
            element={
              <RequirePermission permission="parked">
                <ParkedPage />
              </RequirePermission>
            }
          />
          <Route
            path="/walk-in"
            element={
              <RequirePermission permission="walkin">
                <WalkInPage />
              </RequirePermission>
            }
          />
          <Route
            path="/history"
            element={
              <RequirePermission permission="history">
                <HistoryPage />
              </RequirePermission>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/admin"
            element={
              <RequirePermission permission={['dashboard', 'revenue']}>
                <AdminHome />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/passes"
            element={
              <RequirePermission permission="passes">
                <PassesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/passes/:id"
            element={
              <RequirePermission permission="passes">
                <PassDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RequirePermission permission="reports">
                <ReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <RequirePermission permission="employees">
                <EmployeesPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
