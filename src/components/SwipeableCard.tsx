import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Phone, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwipeableCardProps {
  children: ReactNode
  onRenew?: () => void
  onCall?: () => void
  renewLabel: string
  callLabel: string
  className?: string
}

export function SwipeableCard({ children, onRenew, onCall, renewLabel, callLabel, className }: SwipeableCardProps) {
  const reduced = useReducedMotion()

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      <div className="absolute inset-0 flex" aria-hidden="true">
        {onRenew && (
          <div className="flex w-1/2 items-center gap-2 bg-amber-500 px-5 font-bold text-navy-900">
            <RefreshCw className="h-5 w-5" />
            <span className="text-sm">{renewLabel}</span>
          </div>
        )}
        <div
          className={cn(
            'flex items-center justify-end gap-2 bg-navy-900 px-5 font-bold text-white dark:bg-navy-700',
            onRenew ? 'w-1/2' : 'w-full',
          )}
        >
          <span className="text-sm">{callLabel}</span>
          <Phone className="h-5 w-5" />
        </div>
      </div>
      <motion.div
        drag={reduced ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        dragSnapToOrigin
        dragDirectionLock
        onDragEnd={(_, info) => {
          if (info.offset.x > 82) onRenew?.()
          else if (info.offset.x < -82) onCall?.()
        }}
        className="relative touch-pan-y rounded-2xl bg-white dark:bg-navy-900"
      >
        {children}
      </motion.div>
    </div>
  )
}
