import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SettingsProvider } from '@/state/SettingsContext'
import { ToastProvider } from '@/state/ToastContext'
import { AuthProvider } from '@/state/AuthContext'
import '@/index.css'

if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
    .catch(() => {})
  if (typeof caches !== 'undefined') {
    void caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('workbox-')).map((k) => caches.delete(k))),
      )
      .catch(() => {})
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
