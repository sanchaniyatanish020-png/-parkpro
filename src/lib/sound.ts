import { hasUserActivation } from '@/lib/utils'

let ctx: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined' || !hasUserActivation()) return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

function beep(freq: number, delay: number, duration: number, gain = 0.09, type: OscillatorType = 'sine') {
  const audio = ensureContext()
  if (!audio) return
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(amp)
  amp.connect(audio.destination)
  const start = audio.currentTime + delay
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

export type SoundKind = 'success' | 'warn' | 'error' | 'tap'

export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return
  try {
    switch (kind) {
      case 'success':
        beep(880, 0, 0.09)
        beep(1318, 0.09, 0.12, 0.075)
        break
      case 'warn':
        beep(700, 0, 0.12, 0.08, 'triangle')
        beep(700, 0.16, 0.14, 0.08, 'triangle')
        break
      case 'error':
        beep(240, 0, 0.16, 0.1, 'sawtooth')
        beep(180, 0.18, 0.22, 0.09, 'sawtooth')
        break
      case 'tap':
        beep(1100, 0, 0.03, 0.03)
        break
    }
  } catch {
    /* audio is best-effort */
  }
}
