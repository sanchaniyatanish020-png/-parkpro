import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  disabled?: boolean
  className?: string
}

const THRESHOLD = 62
const MAX_PULL = 96

export function PullToRefresh({ onRefresh, children, disabled, className }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const pulling = useRef(false)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)

  useEffect(() => {
    const node = containerRef.current
    if (!node || disabled) return

    const reset = () => {
      start.current = null
      pulling.current = false
      pullRef.current = 0
      setPull(0)
    }

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0 || refreshing) return
      start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
      pulling.current = false
    }

    const onMove = (event: TouchEvent) => {
      if (!start.current || refreshing) return
      const dx = event.touches[0].clientX - start.current.x
      const dy = event.touches[0].clientY - start.current.y

      if (!pulling.current) {
        if (dy < 0 || Math.abs(dx) > Math.abs(dy) * 1.4) {
          reset()
          return
        }
        if (dy > 10) pulling.current = true
      }

      if (pulling.current) {
        const next = Math.min(MAX_PULL, Math.max(0, dy * 0.5))
        pullRef.current = next
        setPull(next)
        if (next > 6 && event.cancelable) event.preventDefault()
      }
    }

    const onEnd = async () => {
      if (!start.current) return
      const distance = pullRef.current
      start.current = null
      pulling.current = false
      if (distance >= THRESHOLD && !refreshing) {
        setRefreshing(true)
        setPull(THRESHOLD)
        try {
          await onRefresh()
        } finally {
          window.setTimeout(() => {
            setRefreshing(false)
            pullRef.current = 0
            setPull(0)
          }, 380)
        }
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }

    node.addEventListener('touchstart', onStart, { passive: true })
    node.addEventListener('touchmove', onMove, { passive: false })
    node.addEventListener('touchend', onEnd)
    node.addEventListener('touchcancel', reset)
    return () => {
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
      node.removeEventListener('touchend', onEnd)
      node.removeEventListener('touchcancel', reset)
    }
  }, [disabled, onRefresh, refreshing])

  const progress = Math.min(1, pull / THRESHOLD)
  const visible = pull > 0 || refreshing

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        aria-hidden={!visible}
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center transition-opacity',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transform: `translateY(${Math.max(8, pull - 12)}px)` }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft dark:bg-navy-800">
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#1868FE]" aria-hidden="true" />
          ) : (
            <RefreshCw
              className="h-5 w-5 text-navy-700 transition-transform dark:text-white"
              style={{ transform: `rotate(${progress * 180}deg)` }}
              aria-hidden="true"
            />
          )}
        </span>
      </div>
      <div
        style={{
          transform: `translateY(${refreshing ? THRESHOLD : pull}px)`,
          transition: pulling.current ? 'none' : 'transform 240ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {children}
      </div>
      <p className="sr-only" role="status">
        {refreshing ? 'Refreshing' : ''}
      </p>
    </div>
  )
}
