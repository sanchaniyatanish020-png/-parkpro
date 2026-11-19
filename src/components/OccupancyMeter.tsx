interface OccupancyMeterProps {
  percent: number
  occupied: number
  capacity: number
  label: string
  freeLabel: string
  statusLabel: string
  size?: number
}

export function OccupancyMeter({ percent, occupied, capacity, label, freeLabel, statusLabel, size = 176 }: OccupancyMeterProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const radius = 66
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference
  const color = clamped >= 90 ? '#DC2626' : clamped >= 75 ? '#F97316' : '#FFB400'
  const trackClass = 'text-navy-100 dark:text-white/10'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={radius} fill="none" strokeWidth="13" className={trackClass} stroke="currentColor" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            strokeWidth="13"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.32,0.72,0,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-[30px] font-semibold leading-none tabular-nums text-navy-900 dark:text-white">
            {clamped}%
          </span>
          <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-navy-500 dark:text-navy-200">
            {label}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold text-navy-700 dark:text-navy-100">
        {occupied} / {capacity} <span className="font-normal text-navy-500 dark:text-navy-300">· {freeLabel}</span>
      </p>
      <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300" aria-live="polite">
        {statusLabel}
      </p>
    </div>
  )
}
