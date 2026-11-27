import { useEffect, useState } from 'react'
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { api, type LoginSecuritySummary } from '@/lib/api'
import { Badge } from '@/components/ui'
import { formatTime } from '@/lib/utils'

export function LoginSecurityCard() {
  const [data, setData] = useState<LoginSecuritySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void api
      .loginSecurity()
      .then((res) => {
        if (active) setData(res)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <section className="surface mt-4 p-4 lg:p-5">
        <div className="h-24 animate-pulse rounded-xl bg-navy-50 dark:bg-white/5" />
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="surface mt-4 p-4 lg:p-5" aria-labelledby="login-security-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-[18px] w-[18px] text-[#1868FE]" aria-hidden="true" />
          <h2 id="login-security-title" className="text-base font-semibold text-navy-900 dark:text-white">
            Login Security
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={data.lockedAccounts.length > 0 ? 'danger' : 'success'}>
            {data.lockedAccounts.length} locked
          </Badge>
          <Badge tone={data.totalFailed > 0 ? 'warning' : 'neutral'}>
            {data.totalFailed} failed attempts
          </Badge>
        </div>
      </div>

      {data.lockedAccounts.length > 0 && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-200">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Currently Locked Accounts
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-rose-700 dark:text-rose-300">
            {data.lockedAccounts.map((acc) => (
              <li key={acc.accountKey} className="flex flex-wrap items-center justify-between gap-2 font-mono">
                <span>@{acc.accountKey} ({acc.failedCount} failed)</span>
                <span>Until {formatTime(acc.lockedUntil)}{acc.lastIp ? ` · ${acc.lastIp}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
            Recent Failed &amp; Lockouts
          </p>
          {data.recentFailed.length === 0 ? (
            <p className="mt-2 text-xs text-navy-400">No failed login attempts recorded.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {data.recentFailed.slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate font-medium text-navy-800 dark:text-navy-100">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                    @{ev.username}
                    {ev.outcome === 'locked' && <Badge tone="danger">Locked</Badge>}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-navy-400">
                    {formatTime(ev.at)}{ev.ip ? ` · ${ev.ip}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
            Recent Successful Logins
          </p>
          {data.recentSuccess.length === 0 ? (
            <p className="mt-2 text-xs text-navy-400">No recent logins.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {data.recentSuccess.slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-navy-800 dark:text-navy-100">@{ev.username}</span>
                  <span className="shrink-0 font-mono text-[11px] text-navy-400">
                    {formatTime(ev.at)}{ev.ip ? ` · ${ev.ip}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
