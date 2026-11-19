import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastTone = 'info' | 'success' | 'error' | 'warning'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastItem extends ToastOptions {
  id: number
  tone: ToastTone
}

interface ToastContextValue {
  toast: (options: ToastOptions | string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'bg-navy-900 text-white dark:bg-white dark:text-navy-900',
  success: 'bg-[#0F7A3D] text-white',
  error: 'bg-[#B91C1C] text-white',
  warning: 'bg-[#C2410C] text-white',
}

const TONE_ICON = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions | string) => {
      const item: ToastItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        tone: 'info',
        duration: 3400,
        ...(typeof options === 'string' ? { message: options } : options),
      }
      setToasts((prev) => [...prev.slice(-2), item])
      window.setTimeout(() => dismiss(item.id), item.duration)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const Icon = TONE_ICON[item.tone]
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className={cn(
                  'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 shadow-lift',
                  TONE_STYLES[item.tone],
                )}
                role={item.tone === 'error' ? 'alert' : 'status'}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="flex-1 text-sm font-medium leading-snug">{item.message}</p>
                {item.action && (
                  <button
                    type="button"
                    onClick={item.action.onClick}
                    className="min-h-[32px] shrink-0 rounded-lg px-2 text-sm font-bold underline underline-offset-4"
                  >
                    {item.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-80 hover:opacity-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
