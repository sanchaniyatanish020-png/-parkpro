import { forwardRef } from 'react'
import { MapPin } from 'lucide-react'
import type { Pass } from '@/types'
import { formatPlate } from '@/lib/utils'
import { useSettings } from '@/state/SettingsContext'
import { QrImage } from '@/components/QrCode'
import { Logo } from '@/components/Logo'

export const PassCard = forwardRef<HTMLDivElement, { pass: Pass; siteName: string; printable?: boolean }>(
  function PassCard({ pass, siteName, printable }, ref) {
    const { t } = useSettings()
    return (
      <div
        ref={ref}
        id={printable ? 'pass-print' : undefined}
        className="relative flex aspect-[1.586/1] w-full max-w-[360px] flex-col justify-between overflow-hidden rounded-2xl text-white"
        style={{
          background: 'linear-gradient(155deg, #17375D 0%, #0B1F3A 48%, #071527 100%)',
          boxShadow: '0 20px 50px -20px rgba(11,31,58,0.75)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(24,104,254,0.4) 0%, rgba(24,104,254,0) 68%)' }}
          aria-hidden="true"
        />
        <div className="relative flex flex-1 flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <Logo size={22} invert showWordmark wordmarkClass="text-white text-sm" />
            <span className="rounded-full bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white shadow-sm">
              {t('passes.topass')}
            </span>
          </div>

          <div className="my-auto flex items-center justify-between gap-3 py-1">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-navy-300">{t('passes.customer')}</p>
                <p className="truncate font-display text-sm font-semibold leading-tight text-white">{pass.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="truncate font-mono text-base font-bold tracking-wider text-[#38BDF8]">
                  {formatPlate(pass.vehicle)}
                </p>
                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold capitalize text-navy-100">
                  {pass.vehicleType}
                </span>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-navy-300">{t('passes.phone')}</p>
                <p className="font-mono text-xs font-semibold text-white">{pass.phone}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center rounded-xl bg-white p-1.5 shadow-sm">
              <div className="h-[72px] w-[72px] overflow-hidden rounded-lg bg-white">
                <QrImage value={pass.token} size={240} />
              </div>
              <p className="mt-1 font-mono text-[9px] font-bold tracking-wider text-navy-900">{pass.token}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-medium text-navy-200">
            <MapPin className="h-3 w-3 shrink-0 text-[#38BDF8]" aria-hidden="true" />
            <span className="truncate">{siteName}</span>
          </div>
        </div>
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-[#1868FE] via-[#38BDF8] to-[#1868FE]" aria-hidden="true" />
      </div>
    )
  },
)
