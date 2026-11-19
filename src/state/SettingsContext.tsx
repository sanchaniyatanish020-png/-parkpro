import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppSettings } from '@/types'
import { applyFontScale, applyLanguage, applyTheme, loadSettings, persistSettings } from '@/lib/settings'
import { createTranslator, type Translate } from '@/lib/i18n'

interface SettingsContextValue {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
  t: Translate
  lang: AppSettings['lang']
  dark: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    persistSettings(settings)
    applyTheme(settings.theme)
    applyLanguage(settings.lang)
    applyFontScale(settings.fontScale)
  }, [settings])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch, notifications: { ...prev.notifications, ...patch.notifications } }))
  }, [])

  const t = useMemo(() => createTranslator(settings.lang), [settings.lang])
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  const value = useMemo(
    () => ({ settings, update, t, lang: settings.lang, dark }),
    [settings, update, t, dark],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
