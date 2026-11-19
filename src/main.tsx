import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SettingsProvider } from '@/state/SettingsContext'
import { ToastProvider } from '@/state/ToastContext'
import { AuthProvider } from '@/state/AuthContext'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
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
