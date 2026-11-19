import { useEffect } from 'react'

type WakeLockSentinel = {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: string, listener: () => void) => void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

/** Keeps the gate phone screen awake while the scanner is open. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    let sentinel: WakeLockSentinel | null = null
    let disposed = false

    const request = async () => {
      try {
        const wakeLock = (navigator as WakeLockNavigator).wakeLock
        if (!wakeLock || document.visibilityState !== 'visible') return
        sentinel = await wakeLock.request('screen')
        sentinel.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        /* not supported or denied — scanning still works */
      }
    }

    void request()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !disposed && !sentinel) void request()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => undefined)
      sentinel = null
    }
  }, [active])
}
