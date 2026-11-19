import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CloudOff,
  CloudUpload,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import type { Direction, ScanEvent } from '@/types'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { EmptyState, ListSkeleton, Segmented } from '@/components/ui'
import { PullToRefresh } from '@/components/PullToRefresh'
import { cn, formatDate, formatDateTime, formatPlate, formatTime } from '@/lib/utils'

type Filter = 'all' | Direction

export default function HistoryPage() {
  const { scans, ready, pendingCount, lastSync, online, syncing, syncNow, refresh } = useData()
  const { t, lang } = useSettings()
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const filtered = filter === 'all' ? scans : scans.filter((event) => event.direction === filter)
    const map = new Map<string, ScanEvent[]>()
    for (const event of filtered) {
      const key = new Date(event.at).toDateString()
      const list = map.get(key)
      if (list) list.push(event)
      else map.set(key, [event])
    }
    return Array.from(map.entries())
  }, [scans, filter])

  const dayLabel = (key: string) => {
    const date = new Date(key)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return t('common.today')
    if (date.toDateString() === yesterday.toDateString()) return t('common.yesterday')
    return formatDate(date, lang)
  }

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="px-page py-4 lg:mx-auto lg:max-w-3xl lg:py-7">
        <p className="text-sm text-navy-500 dark:text-navy-200">{t('history.subtitle')}</p>

        {pendingCount > 0 && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/25 dark:bg-blue-500/10">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#1868FE] to-[#2B7BFF] text-white shadow-sm">
                <CloudUpload className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  {t('history.pendingTitle', { n: pendingCount })}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-blue-800/80 dark:text-blue-200/80">
                  {t('history.pendingBody')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void syncNow(true)}
              disabled={!online || syncing}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#1868FE] text-sm font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-50 dark:bg-[#1868FE] dark:text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('history.syncing', { n: pendingCount })}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('action.syncNow')}
                </>
              )}
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
              { id: 'IN', label: t('history.entry'), icon: ArrowDownLeft },
              { id: 'OUT', label: t('history.exit'), icon: ArrowUpRight },
              { id: 'DENIED', label: t('history.denied'), icon: Ban },
            ]}
          />
        </div>

        {lastSync && (
          <p className="mt-2.5 flex items-center justify-end gap-1.5 text-[11px] font-medium text-navy-400 dark:text-navy-300">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {t('settings.lastSync')}: {formatDateTime(lastSync, lang)}
          </p>
        )}

        <div className="mt-3 space-y-4">
          {!ready ? (
            <ListSkeleton rows={6} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={scans.length === 0 ? History : ShieldAlert}
              title={scans.length === 0 ? t('history.emptyTitle') : t('common.noResults')}
              body={scans.length === 0 ? t('history.emptyBody') : t('history.subtitle')}
            />
          ) : (
            groups.map(([day, events]) => (
              <section key={day} aria-label={dayLabel(day)}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
                    {dayLabel(day)}
                  </h2>
                  <span className="text-[11px] font-semibold text-navy-400 dark:text-navy-300">
                    {t('reports.totalPasses', { n: events.length })}
                  </span>
                </div>
                <ul className="surface divide-y divide-navy-100 overflow-hidden dark:divide-white/10">
                  {events.map((event) => (
                    <ScanRow key={event.id} event={event} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <p className="mt-5 flex items-start gap-1.5 text-[11px] leading-snug text-navy-400 dark:text-navy-300">
          <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('settings.syncHint')}
        </p>
      </div>
    </PullToRefresh>
  )
}

function ScanRow({ event }: { event: ScanEvent }) {
  const { t, lang } = useSettings()

  const tone =
    event.direction === 'IN'
      ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]'
      : event.direction === 'OUT'
        ? 'bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-navy-100'
        : 'bg-[#FEE2E2] text-[#B91C1C] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5]'

  const Icon = event.direction === 'IN' ? ArrowDownLeft : event.direction === 'OUT' ? ArrowUpRight : Ban
  const label =
    event.direction === 'IN' ? t('history.entry') : event.direction === 'OUT' ? t('history.exit') : t('history.denied')

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full', tone)}>
        {event.photo ? (
          <img src={event.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon className="h-5 w-5" aria-hidden="true" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">
            {event.name ?? t('scan.unknown')}
          </p>
          {!event.synced && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-500/15 dark:text-blue-200">
              <CloudOff className="h-3 w-3" aria-hidden="true" />
              {t('common.pending')}
            </span>
          )}
          {event.outcome === 'expiring' && event.direction !== 'DENIED' && (
            <span className="shrink-0 rounded-full bg-[#FFEDD5] px-2 py-0.5 text-[10px] font-bold text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]">
              {t('status.expiring')}
            </span>
          )}
          {event.outcome === 'expired' && (
            <span className="shrink-0 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#991B1B] dark:bg-[#DC2626]/18 dark:text-[#FCA5A5]">
              {t('status.expired')}
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate font-mono text-xs font-medium text-navy-600 dark:text-navy-200">
          {event.vehicle ? formatPlate(event.vehicle) : event.token || '—'}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-navy-400 dark:text-navy-300">
          <span
            className={cn(
              'font-bold',
              event.direction === 'IN'
                ? 'text-[#15803D] dark:text-[#86EFAC]'
                : event.direction === 'OUT'
                  ? 'text-navy-600 dark:text-navy-100'
                  : 'text-[#B91C1C] dark:text-[#FCA5A5]',
            )}
          >
            {label}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{formatTime(event.at, lang)}</span>
          <span aria-hidden="true">·</span>
          <span>{event.source === 'camera' ? t('history.fromCamera') : t('history.manual')}</span>
        </div>
      </div>
    </li>
  )
}
