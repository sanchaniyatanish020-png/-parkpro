import { useMemo, useState } from 'react'
import {
  CloudOff,
  CloudUpload,
  Loader2,
  RefreshCw,
  ScanLine,
  ScrollText,
  Settings2,
  ShieldCheck,
  Ticket,
  Trash2,
  UserRoundPlus,
} from 'lucide-react'
import type { AuditLog, LogKind } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { Button, EmptyState, ListSkeleton, Segmented } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { PullToRefresh } from '@/components/PullToRefresh'
import { cn, formatDate, formatTime } from '@/lib/utils'

type Filter = 'all' | 'scans' | 'passes' | 'sync' | 'auth' | 'system'

const KIND_META: Record<LogKind, { icon: typeof ScanLine; labelKey: string }> = {
  scan: { icon: ScanLine, labelKey: 'logs.scan' },
  walkin: { icon: UserRoundPlus, labelKey: 'nav.walkin' },
  pass: { icon: Ticket, labelKey: 'logs.pass' },
  sync: { icon: RefreshCw, labelKey: 'logs.sync' },
  auth: { icon: ShieldCheck, labelKey: 'logs.auth' },
  system: { icon: Settings2, labelKey: 'logs.system' },
}

const LEVEL_TONE = {
  success: 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]',
  warn: 'bg-[#FFEDD5] text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]',
  error: 'bg-[#FEE2E2] text-[#B91C1C] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5]',
  info: 'bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-navy-100',
}

export default function LogsPage() {
  const { logs, ready, refresh, clearLogs, pendingCount, online, syncing, syncNow } = useData()
  const { t, lang } = useSettings()
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const groups = useMemo(() => {
    const matches = (kind: LogKind) => {
      if (filter === 'all') return true
      if (filter === 'scans') return kind === 'scan' || kind === 'walkin'
      if (filter === 'passes') return kind === 'pass'
      return kind === filter
    }
    const map = new Map<string, AuditLog[]>()
    for (const log of logs) {
      if (!matches(log.kind)) continue
      const key = new Date(log.at).toDateString()
      const list = map.get(key)
      if (list) list.push(log)
      else map.set(key, [log])
    }
    return Array.from(map.entries())
  }, [logs, filter])

  const dayLabel = (key: string) => {
    const date = new Date(key)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return t('common.today')
    if (date.toDateString() === yesterday.toDateString()) return t('common.yesterday')
    return formatDate(date, lang)
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      await clearLogs()
      setConfirmOpen(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-3xl lg:py-7">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[70%] text-sm text-navy-500 dark:text-navy-200">{t('logs.subtitle')}</p>
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={() => setConfirmOpen(true)}
            disabled={logs.length === 0}
            className="min-h-[44px] shrink-0 px-3 text-xs"
          >
            {t('logs.clear')}
          </Button>
        </div>

        {pendingCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-500/25 dark:bg-amber-500/10">
            <CloudUpload className="h-5 w-5 shrink-0 text-[#9A3412] dark:text-amber-300" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-xs font-semibold text-[#7C4A00] dark:text-amber-200">
              {t('logs.pendingUpload', { n: pendingCount })}
            </p>
            <button
              type="button"
              onClick={() => void syncNow(true)}
              disabled={!online || syncing}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-navy-900 px-3 text-xs font-bold text-white disabled:opacity-50 dark:bg-amber-500 dark:text-navy-900"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t('action.syncNow')}
            </button>
          </div>
        )}

        <div className="mt-4">
          <Segmented
            ariaLabel={t('action.filters')}
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: t('action.all') },
              { id: 'scans', label: t('logs.scan') },
              { id: 'passes', label: t('logs.pass') },
              { id: 'sync', label: t('logs.sync') },
              { id: 'auth', label: t('logs.auth') },
              { id: 'system', label: t('logs.system') },
            ]}
          />
        </div>

        <div className="mt-4 space-y-4">
          {!ready ? (
            <ListSkeleton rows={6} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={logs.length === 0 ? ScrollText : CloudOff}
              title={logs.length === 0 ? t('logs.emptyTitle') : t('common.noResults')}
              body={logs.length === 0 ? t('logs.emptyBody') : t('logs.subtitle')}
            />
          ) : (
            groups.map(([day, entries]) => (
              <section key={day} aria-label={dayLabel(day)}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
                  {dayLabel(day)}
                </h2>
                <ul className="surface divide-y divide-navy-100 overflow-hidden dark:divide-white/10">
                  {entries.map((log) => {
                    const meta = KIND_META[log.kind]
                    const Icon = meta.icon
                    return (
                      <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                        <span
                          className={cn(
                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            LEVEL_TONE[log.level],
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-navy-800 dark:text-navy-50">{log.message}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-navy-400 dark:text-navy-300">
                            <span className="font-semibold">{t(meta.labelKey)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{formatTime(log.at, lang)}</span>
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <p className="mt-5 text-center text-[11px] leading-snug text-navy-400 dark:text-navy-300">{t('logs.localNote')}</p>
      </div>

      <Sheet
        open={confirmOpen}
        onClose={() => (clearing ? undefined : setConfirmOpen(false))}
        title={t('logs.clear')}
        subtitle={t('logs.subtitle')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" full onClick={() => setConfirmOpen(false)} disabled={clearing} className="min-h-[48px]">
              {t('action.cancel')}
            </Button>
            <Button variant="danger" full loading={clearing} onClick={() => void handleClear()} className="min-h-[48px]">
              {t('logs.clear')}
            </Button>
          </div>
        }
      >
        <p className="rounded-2xl bg-[#FEF2F2] p-4 text-sm text-[#991B1B] dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
          {t('logs.clearConfirm')}
        </p>
      </Sheet>
    </PullToRefresh>
  )
}
