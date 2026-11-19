import { cn } from '@/lib/utils'

export function Logo({
  size = 38,
  showWordmark = true,
  showSubtitle = false,
  wordmarkClass,
  className,
}: {
  size?: number
  showWordmark?: boolean
  showSubtitle?: boolean
  wordmarkClass?: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-3 select-none', className)}>
      {/* Modern Ribbon "P" with Sheltered Smart Car */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label="ParkPro"
        className="shrink-0 drop-shadow-sm transition-transform"
      >
        <defs>
          <linearGradient id="pp-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00A3FF" />
            <stop offset="55%" stopColor="#1868FE" />
            <stop offset="100%" stopColor="#0A52E2" />
          </linearGradient>
          <linearGradient id="pp-car-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1868FE" />
            <stop offset="100%" stopColor="#0A52E2" />
          </linearGradient>
        </defs>

        {/* Outer Ribbon "P" Canopy */}
        <path
          d="M 22 82 L 22 30 A 14 14 0 0 1 36 16 L 55 16 A 23 23 0 0 1 78 39 A 23 23 0 0 1 55 62 L 46 62"
          fill="none"
          stroke="url(#pp-ribbon-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Canopy suspension post */}
        <line
          x1="50"
          y1="23"
          x2="50"
          y2="43"
          stroke="url(#pp-car-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Car Tires */}
        <rect x="36" y="67" width="5" height="7" rx="2.5" fill="url(#pp-car-grad)" />
        <rect x="59" y="67" width="5" height="7" rx="2.5" fill="url(#pp-car-grad)" />

        {/* Car Side Mirrors */}
        <rect x="31" y="52" width="4" height="4" rx="2" fill="url(#pp-car-grad)" />
        <rect x="65" y="52" width="4" height="4" rx="2" fill="url(#pp-car-grad)" />

        {/* Car Body with transparent windshield cutout via evenodd */}
        <path
          fillRule="evenodd"
          d="M 43 43 C 45 42.5 55 42.5 57 43 C 58.5 43 62.5 52 64.5 54 C 66 55.5 67 57 67 59 L 67 67 C 67 69 65 70 63 70 L 37 70 C 35 70 33 69 33 67 L 33 59 C 33 57 34 55.5 35.5 54 C 37.5 52 41.5 43 43 43 Z M 45 46.5 L 55 46.5 C 56 46.5 59 51.5 60 53.5 C 60.3 54 60 54.5 59.3 54.5 L 40.7 54.5 C 40 54.5 39.7 54 40 53.5 C 41 51.5 44 46.5 45 46.5 Z"
          fill="url(#pp-car-grad)"
        />

        {/* Car Headlights */}
        <circle cx="40" cy="62" r="2.2" fill="#FFFFFF" />
        <circle cx="60" cy="62" r="2.2" fill="#FFFFFF" />
      </svg>

      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <span className={cn('font-display text-xl font-bold tracking-tight', wordmarkClass)}>
            <span className="text-[#0B1F3A] dark:text-white">Park</span>
            <span className="text-[#1868FE]">Pro</span>
          </span>
          {showSubtitle && (
            <span className="text-[10px] font-semibold text-slate-500 tracking-wide mt-0.5">
              Parking Management System
            </span>
          )}
        </div>
      )}
    </span>
  )
}
