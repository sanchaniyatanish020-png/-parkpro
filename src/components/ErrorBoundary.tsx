import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCw, ShieldAlert } from 'lucide-react'
import { useSettings } from '@/state/SettingsContext'

function ErrorFallback() {
  const { t } = useSettings()
  return (
    <div className="mesh-navy flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center text-white">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
        <ShieldAlert className="h-7 w-7 text-amber-400" aria-hidden="true" />
      </span>
      <div className="max-w-sm">
        <h1 className="font-display text-xl font-bold">{t('errors.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t('errors.body')}</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-amber-500 px-5 text-sm font-bold text-navy-950 transition-colors hover:bg-amber-400"
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        {t('errors.reload')}
      </button>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ParkPro crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.failed) return <ErrorFallback />
    return this.props.children
  }
}
