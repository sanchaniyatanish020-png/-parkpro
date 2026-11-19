import { forwardRef } from 'react'
import { MapPin } from 'lucide-react'
import type { Pass } from '@/types'
import { formatDate, formatPlate, planLabel } from '@/lib/utils'
import { useSettings } from '@/state/SettingsContext'
import { QrImage } from '@/components/QrCode'
import { Logo } from '@/components/Logo'

export const PassCard = forwardRef<HTMLDivElement, { pass: Pass; siteName: string; printable?: boolean }>(
  function PassCard({ pass, siteName, printable }, ref) {
    const { t, lang } = useSettings()
    return (
      <div
        ref={ref}
        id={printable ? 'pass-print' : undefined}
        className="relative w-full max-w-[340px] overflow-hidden rounded-[28px] text-white"
        style={{
          background: 'linear-gradient(155deg, #17375D 0%, #0B1F3A 48%, #071527 100%)',
          boxShadow: '0 24px 60px -24px rgba(11,31,58,0.75)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(24,104,254,0.4) 0%, rgba(24,104,254,0) 68%)' }}
          aria-hidden="true"
        />
        <div className="relative p-5">
          <div className="flex items-center justify-between">
            <Logo size={30} showWordmark wordmarkClass="text-white text-lg" />
            <span className="rounded-full bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white shadow-sm">
              {t('passes.topass')}
            </span>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy-300">{t('passes.customer')}</p>
            <p className="mt-1 truncate font-display text-xl font-semibold leading-tight">{pass.name}</p>
          </div>

          <div className="mt-3 flex items-end justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-300">{t('common.vehicle')}</p>
              <p className="mt-0.5 truncate font-mono text-[22px] font-semibold tracking-wider text-[#38BDF8]">
                {formatPlate(pass.vehicle)}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold capitalize text-navy-100">
              {pass.vehicleType}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-300">{t('passes.validity')}</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-white">{formatDate(pass.endDate, lang)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-300">{t('passes.plan')}</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{planLabel(pass.plan, t)}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3.5 rounded-2xl bg-white p-3">
            <div className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-white">
              <QrImage value={pass.token} size={320} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-navy-400">{t('passes.token')}</p>
              <p className="mt-0.5 break-all font-mono text-[13px] font-semibold leading-tight text-navy-900">{pass.token}</p>
              <p className="mt-2 text-[11px] leading-snug text-navy-500">{t('passes.qrHint')}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-navy-200">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" aria-hidden="true" />
            <span className="truncate">{siteName}</span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-gradient-to-r from-[#1868FE] via-[#38BDF8] to-[#1868FE]" aria-hidden="true" />
      </div>
    )
  },
)
