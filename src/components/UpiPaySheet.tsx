import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Copy, ExternalLink, QrCode, Settings2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { QrImage } from '@/components/QrCode'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { buildUpiUri, normalizeUpiId } from '@/lib/upi'
import { copyText } from '@/lib/share'
import { formatMoney } from '@/lib/utils'

interface UpiPaySheetProps {
  open: boolean
  amount: number
  note?: string
  confirmLabel: string
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function UpiPaySheet({ open, amount, note, confirmLabel, busy, onClose, onConfirm }: UpiPaySheetProps) {
  const { t, lang, settings } = useSettings()
  const { can } = useAuth()
  const { toast } = useToast()
  const [copied, setCopied] = useState<'id' | 'link' | null>(null)

  const vpa = normalizeUpiId(settings.upiId)
  const payee = settings.upiName.trim() || settings.ownerName.trim() || settings.siteName
  const uri = vpa ? buildUpiUri({ vpa, payee, amount, note }) : ''
  const canEditSite = can('siteSettings')

  useEffect(() => {
    if (!open) setCopied(null)
  }, [open])

  const copy = async (text: string, which: 'id' | 'link') => {
    const ok = await copyText(text)
    if (!ok) {
      toast({ message: t('toast.error'), tone: 'error' })
      return
    }
    setCopied(which)
    window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <Sheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={t('upi.title')}
      subtitle={t('upi.subtitle', { amount: formatMoney(amount, lang) })}
      footer={
        <div>
          {uri && (
            <p className="mb-2 text-center text-[11px] leading-snug text-navy-400 dark:text-navy-300">
              {t('upi.confirmHint')}
            </p>
          )}
          <Button
            full
            variant="success"
            loading={busy}
            onClick={onConfirm}
            icon={CheckCircle2}
            className="min-h-[54px]"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <div className="mesh-navy relative overflow-hidden rounded-2xl p-4 text-white shadow-soft">
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue-500/25 blur-2xl"
            aria-hidden="true"
          />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-200">{t('upi.amountLabel')}</p>
          <p className="mt-1 font-display text-[32px] font-bold leading-none tabular-nums">
            {formatMoney(amount, lang)}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
            <Smartphone className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-xs text-navy-100">
              <span className="text-navy-300">{t('upi.payee')}: </span>
              <span className="font-semibold text-white">{vpa ? payee : '—'}</span>
            </p>
          </div>
        </div>

        {vpa ? (
          <>
            <div className="mx-auto w-full max-w-[264px] rounded-2xl border border-navy-100 bg-white p-3 shadow-soft dark:border-white/10">
              <QrImage value={uri} size={520} className="aspect-square rounded-lg" />
            </div>
            <p className="text-center text-xs font-medium text-navy-500 dark:text-navy-300">{t('upi.scanHint')}</p>

            <div className="rounded-2xl bg-navy-50 px-3.5 py-3 dark:bg-white/[0.05]">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 shrink-0 text-navy-400" aria-hidden="true" />
                <p className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-navy-800 dark:text-navy-100">
                  {vpa}
                </p>
                <button
                  type="button"
                  onClick={() => void copy(vpa, 'id')}
                  className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-bold text-navy-700 shadow-sm active:scale-95 dark:bg-white/10 dark:text-white"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copied === 'id' ? t('upi.copiedId') : t('upi.copyId')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={uri}
                className="btn-ghost min-h-[46px] gap-1.5 px-2 text-xs"
                aria-label={t('upi.openApp')}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('upi.openApp')}
              </a>
              <button
                type="button"
                onClick={() => void copy(uri, 'link')}
                className="btn-ghost min-h-[46px] gap-1.5 px-2 text-xs"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied === 'link' ? t('upi.copiedLink') : t('upi.copyLink')}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
            <p className="text-sm font-bold text-[#7C4A00] dark:text-amber-200">{t('upi.missingTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#7C4A00]/90 dark:text-amber-200/85">{t('upi.missingBody')}</p>
            {canEditSite && (
              <Link
                to="/settings"
                className="mt-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-[#7C4A00] shadow-sm ring-1 ring-amber-200 active:scale-95 dark:bg-white/10 dark:text-amber-100 dark:ring-white/15"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                {t('upi.missingAction')}
              </Link>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
