import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, SelectInput } from '@/components/ui'
import { api, ApiError, type EmployeeLeave } from '@/lib/api'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'

function todayDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function StaffLeaveSection() {
  const { t } = useSettings()
  const { toast } = useToast()

  const [leaves, setLeaves] = useState<EmployeeLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [leaveDate, setLeaveDate] = useState(todayDateKey)
  const [leaveType, setLeaveType] = useState<'full' | 'half'>('full')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listMyLeaves()
      setLeaves(res.leaves)
    } catch {
      /* silent when offline */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !leaveDate) return
    setSubmitting(true)
    try {
      await api.requestMyLeave({
        leaveDate,
        leaveType,
        reason: reason.trim() || undefined,
      })
      toast({ message: 'Leave request sent to admin', tone: 'success' })
      setReason('')
      await load()
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not send leave request',
        tone: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(leaveId: string) {
    try {
      await api.cancelMyLeave(leaveId)
      toast({ message: 'Leave request cancelled', tone: 'info' })
      setLeaves((prev) => prev.filter((l) => l.id !== leaveId))
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not cancel request',
        tone: 'error',
      })
    }
  }

  return (
    <section className="surface mt-4 p-4" aria-labelledby="staff-leave-title">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <CalendarOff className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="staff-leave-title" className="text-base font-semibold text-navy-900 dark:text-white">
              {t('emp.requestLeave')}
            </h2>
            <p className="text-xs text-navy-500 dark:text-navy-300">{t('emp.myLeaves')}</p>
          </div>
        </div>
        <Badge tone="neutral">{leaves.length}</Badge>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 grid gap-2.5 sm:grid-cols-[160px_150px_1fr_auto]">
        <input
          type="date"
          value={leaveDate}
          onChange={(e) => setLeaveDate(e.target.value)}
          required
          className="h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-[#1868FE] dark:border-white/15 dark:bg-navy-900 dark:text-white"
        />
        <SelectInput
          label=""
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value === 'half' ? 'half' : 'full')}
          className="h-10 py-1.5 text-sm"
        >
          <option value="full">{t('emp.fullDay')}</option>
          <option value="half">{t('emp.halfDay')}</option>
        </SelectInput>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('emp.reason')}
          className="h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-[#1868FE] dark:border-white/15 dark:bg-navy-900 dark:text-white"
        />
        <Button type="submit" variant="primary" icon={Plus} disabled={submitting} className="min-h-[40px] px-4 text-sm">
          {submitting ? t('common.loading') : t('emp.requestLeave')}
        </Button>
      </form>

      {loading ? (
        <p className="py-4 text-center text-xs text-navy-400 dark:text-navy-300">{t('common.loading')}</p>
      ) : leaves.length === 0 ? (
        <p className="py-4 text-center text-xs text-navy-400 dark:text-navy-300">{t('emp.noLeaves')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-navy-100 rounded-xl border border-navy-100 dark:divide-white/10 dark:border-white/10">
          {leaves.map((lv) => (
            <li key={lv.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-navy-900 dark:text-white">
                    {lv.leaveDate}
                  </span>
                  <Badge tone={lv.leaveType === 'half' ? 'warning' : 'amber'}>
                    {lv.leaveType === 'half' ? t('emp.halfDay') : t('emp.fullDay')}
                  </Badge>
                  <Badge
                    tone={
                      lv.status === 'approved'
                        ? 'success'
                        : lv.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {t(`emp.${lv.status}`)}
                  </Badge>
                </div>
                {lv.reason && (
                  <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-300">{lv.reason}</p>
                )}
              </div>
              {lv.status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => void handleCancel(lv.id)}
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
