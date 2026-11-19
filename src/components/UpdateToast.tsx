import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'
import { useSettings } from '@/state/SettingsContext'

export function UpdateToast() {
  const { t } = useSettings()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy-900 p-3.5 text-white shadow-lift dark:bg-white dark:text-navy-900 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:mx-0 lg:w-[360px]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] text-white shadow-sm">
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t('admin.updateTitle')}</p>
        <p className="text-xs opacity-80">{t('admin.updateBody')}</p>
      </div>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-[40px] shrink-0 rounded-xl bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] px-3.5 text-xs font-bold text-white shadow-sm"
      >
        {t('admin.updateNow')}
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="min-h-[40px] shrink-0 rounded-xl px-2 text-xs font-semibold opacity-80"
      >
        {t('action.dismiss')}
      </button>
    </div>
  )
}
