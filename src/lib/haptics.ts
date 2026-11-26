import { hasUserActivation } from '@/lib/utils'

export const HAPTIC = {
  tap: 12,
  success: [30, 40, 70],
  warn: [60, 50, 60],
  error: [90, 55, 90, 55, 140],
}

export function vibrate(pattern: number | number[], enabled: boolean) {
  if (!enabled || !hasUserActivation()) return
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern as number | number[])
    }
  } catch {
    /* vibration is best-effort */
  }
}
