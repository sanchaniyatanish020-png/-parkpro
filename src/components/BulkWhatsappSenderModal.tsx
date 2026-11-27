import { useState } from 'react'
import { Check, CheckCircle2, MessageCircle, SkipForward } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Badge, Button } from '@/components/ui'
import { useSettings } from '@/state/SettingsContext'
import { useData } from '@/state/DataContext'
import { formatPlate, formatDate } from '@/lib/utils'
import type { WhatsappCustomerItem } from '@/lib/whatsappReminders'

interface BulkWhatsappSenderModalProps {
  open: boolean
  onClose: () => void
  items: WhatsappCustomerItem[]
  onComplete: () => void
}

export function BulkWhatsappSenderModal({ open, onClose, items, onComplete }: BulkWhatsappSenderModalProps) {
  const { lang } = useSettings()
  const { markReminder } = useData()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [openedIndexSet, setOpenedIndexSet] = useState<Set<number>>(new Set())
  const [confirmedIndexSet, setConfirmedIndexSet] = useState<Set<number>>(new Set())
  const [skippedIndexSet, setSkippedIndexSet] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  if (!open || items.length === 0) return null

  const currentItem = items[currentIndex]
  const isFinished = currentIndex >= items.length

  const handleOpenWhatsApp = () => {
    if (!currentItem || !currentItem.waUrl) return
    window.open(currentItem.waUrl, '_blank', 'noopener,noreferrer')
    setOpenedIndexSet((prev) => new Set(prev).add(currentIndex))
    void markReminder(currentItem.pass.id, currentItem.message, {
      channel: 'click_to_chat',
      status: 'opened',
      reminderType: currentItem.windowType,
    })
  }

  const handleConfirmSent = async () => {
    if (!currentItem) return
    setSubmitting(true)
    try {
      await markReminder(currentItem.pass.id, currentItem.message, {
        channel: 'click_to_chat',
        status: 'sent',
        reminderType: currentItem.windowType,
      })
      setConfirmedIndexSet((prev) => new Set(prev).add(currentIndex))
      moveToNext()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = async () => {
    if (!currentItem) return
    setSubmitting(true)
    try {
      await markReminder(currentItem.pass.id, currentItem.message, {
        channel: 'click_to_chat',
        status: 'skipped',
        reminderType: currentItem.windowType,
      })
      setSkippedIndexSet((prev) => new Set(prev).add(currentIndex))
      moveToNext()
    } finally {
      setSubmitting(false)
    }
  }

  const moveToNext = () => {
    if (currentIndex + 1 < items.length) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setCurrentIndex(items.length)
      onComplete()
    }
  }

  const progressPercentage = Math.round((currentIndex / items.length) * 100)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send WhatsApp Reminders"
      subtitle={`${items.length} customers selected`}
      desktopFullscreen
    >
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="rounded-2xl border border-navy-100 bg-navy-50/50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between text-xs font-semibold text-navy-700 dark:text-navy-200">
            <span>
              Customer {Math.min(currentIndex + 1, items.length)} of {items.length}
            </span>
            <span>{progressPercentage}% Processed</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-navy-200/50 dark:bg-white/10">
            <div
              className="h-full bg-[#16A34A] transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-navy-600 dark:text-navy-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#16A34A]" />
              Sent (Confirmed): <b className="text-navy-900 dark:text-white">{confirmedIndexSet.size}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              Opened: <b className="text-navy-900 dark:text-white">{openedIndexSet.size}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-navy-400" />
              Skipped: <b className="text-navy-900 dark:text-white">{skippedIndexSet.size}</b>
            </span>
          </div>
        </div>

        {isFinished ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-navy-900 dark:text-white">Batch Completed!</h3>
            <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
              All {items.length} customer reminders have been processed.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={onClose} className="px-6">
                Done
              </Button>
            </div>
          </div>
        ) : (
          currentItem && (
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-navy-900">
              {/* Customer Header */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-navy-100 pb-4 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-navy-900 dark:text-white">{currentItem.pass.name}</h3>
                    {currentItem.windowType === 'expired' ? (
                      <Badge tone="danger">Expired</Badge>
                    ) : currentItem.windowType === 'today' ? (
                      <Badge tone="amber">Expiring Today</Badge>
                    ) : currentItem.windowType === '1_day' ? (
                      <Badge tone="warning">Tomorrow</Badge>
                    ) : (
                      <Badge tone="neutral">In 3 Days</Badge>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs text-navy-500 dark:text-navy-300">
                    {formatPlate(currentItem.pass.vehicle)} · {currentItem.pass.plan.toUpperCase()} · Expiry:{' '}
                    {formatDate(currentItem.pass.endDate, lang)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-semibold text-navy-700 dark:text-navy-200">
                    +{currentItem.formattedPhone}
                  </span>
                </div>
              </div>

              {/* Message Preview Box */}
              <div className="mt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400">
                  WhatsApp Message Preview (Pre-filled):
                </label>
                <div className="mt-1.5 whitespace-pre-wrap rounded-xl border border-emerald-200/80 bg-[#E7F8ED]/60 p-4 font-sans text-xs leading-relaxed text-navy-900 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-100">
                  {currentItem.message}
                </div>
              </div>

              {/* Action Flow */}
              <div className="mt-5 space-y-3">
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  {/* Step 1: Open WhatsApp */}
                  <Button
                    variant="primary"
                    onClick={handleOpenWhatsApp}
                    icon={MessageCircle}
                    className="flex-1 bg-[#25D366] text-white hover:bg-[#20ba59] active:bg-[#1da850]"
                  >
                    1. Open WhatsApp Chat
                  </Button>

                  {/* Step 2: Confirm Sent */}
                  <Button
                    variant="navy"
                    onClick={handleConfirmSent}
                    disabled={submitting}
                    icon={Check}
                    className="flex-1 bg-[#1A4C8B] hover:bg-[#163f73]"
                  >
                    2. Mark as Sent & Next
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    disabled={submitting}
                    icon={SkipForward}
                    className="text-xs text-navy-500"
                  >
                    Skip Customer
                  </Button>

                  <span className="text-[11px] text-navy-400">
                    Click "Open WhatsApp Chat" → Press Send in WhatsApp → Click "Mark as Sent & Next"
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </Sheet>
  )
}
