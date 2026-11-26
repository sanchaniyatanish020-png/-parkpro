import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  desktopFullscreen?: boolean
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  desktopFullscreen,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const subtitleId = useId()
  const reduced = useReducedMotion()

  // Keep a stable ref to the latest onClose callback so useEffect does not re-run on parent re-renders
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Only focus the dialog container on initial open if an input inside is not already focused
    const timer = window.setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) {
        panelRef.current?.focus()
      }
    }, 60)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitle ? subtitleId : undefined}
            tabIndex={-1}
            initial={{ y: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 }}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 38 }}
            drag={reduced ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose()
            }}
            className={cn(
              'absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-white shadow-lift outline-none dark:bg-navy-900',
              desktopFullscreen && 'lg:inset-0 lg:h-dvh lg:max-h-none lg:max-w-none lg:rounded-none',
              className,
            )}
          >
            <div className={cn('flex justify-center pt-2.5', desktopFullscreen && 'lg:hidden')} aria-hidden="true">
              <span className="h-1.5 w-11 rounded-full bg-navy-200 dark:bg-white/20" />
            </div>
            <div
              className={cn(
                'flex items-start gap-3 px-5 pb-3 pt-1.5',
                desktopFullscreen && 'lg:mx-auto lg:w-full lg:max-w-5xl lg:px-8 lg:pt-6',
              )}
            >
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-xl font-semibold text-navy-900 dark:text-white lg:text-2xl">
                  {title}
                </h2>
                {subtitle && (
                  <p id={subtitleId} className="mt-1 text-sm text-navy-500 dark:text-navy-200">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="icon-btn -mr-1 border-transparent bg-navy-50 dark:bg-white/10"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6',
                desktopFullscreen && 'lg:mx-auto lg:w-full lg:max-w-5xl lg:px-8 lg:pb-10',
              )}
            >
              {children}
            </div>
            {footer && (
              <div className="border-t border-navy-100 bg-white/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur dark:border-white/10 dark:bg-navy-900/95">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return typeof document === 'undefined' ? null : createPortal(content, document.body)
}
