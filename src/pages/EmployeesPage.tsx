import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarOff,
  Check,
  Clock,
  Eye,
  IndianRupee,
  LogIn,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Sheet } from '@/components/Sheet'
import { Avatar, Badge, Button, EmptyState, SelectInput, TextInput } from '@/components/ui'
import {
  api,
  ApiError,
  type EmployeeDetailsResponse,
  type PendingLeaveRequest,
  type StaffMember,
} from '@/lib/api'
import { DEFAULT_STAFF_PERMISSIONS, PERMISSION_ITEMS, toggleStaffPermission } from '@/lib/permissions'
import { cn, formatDateShort, formatMoney, formatTime } from '@/lib/utils'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import type { StaffPermissions } from '@/types'

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins}m`
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`
}

export default function EmployeesPage() {
  const { t, settings } = useSettings()
  const { role } = useAuth()
  const { toast } = useToast()
  const lang = settings.lang

  const [month, setMonth] = useState(currentMonthKey)
  const [query, setQuery] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingLeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newMonthlySalary, setNewMonthlySalary] = useState('15000')
  const [newPerms, setNewPerms] = useState<StaffPermissions>(() => ({ ...DEFAULT_STAFF_PERMISSIONS }))
  const [creating, setCreating] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [details, setDetails] = useState<EmployeeDetailsResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const [savingSalary, setSavingSalary] = useState(false)

  const [rightsMember, setRightsMember] = useState<StaffMember | null>(null)
  const [rightsDraft, setRightsDraft] = useState<StaffPermissions>(() => ({ ...DEFAULT_STAFF_PERMISSIONS }))
  const [savingRights, setSavingRights] = useState(false)

  const [leaveDate, setLeaveDate] = useState(todayDateKey)
  const [leaveType, setLeaveType] = useState<'full' | 'half'>('full')
  const [leaveReason, setLeaveReason] = useState('')
  const [savingLeave, setSavingLeave] = useState(false)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listStaff(month)
      setStaff(res.staff)
      setPendingRequests(res.pendingRequests ?? [])
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not load employees',
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [month, toast])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  const loadDetails = useCallback(
    async (id: string, targetMonth = month) => {
      setDetailLoading(true)
      try {
        const res = await api.getEmployeeDetails(id, targetMonth)
        setDetails(res)
        setSalaryDraft(String(res.employee.monthlySalary ?? 0))
      } catch (error) {
        toast({
          message: error instanceof ApiError ? error.message : 'Could not load employee details',
          tone: 'error',
        })
      } finally {
        setDetailLoading(false)
      }
    },
    [month, toast],
  )

  useEffect(() => {
    if (detailId) {
      void loadDetails(detailId, month)
    }
  }, [detailId, month, loadDetails])

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return staff
    return staff.filter(
      (s) => s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q),
    )
  }, [staff, query])

  const totals = useMemo(() => {
    const active = staff.filter((s) => s.active).length
    const totalHours = staff.reduce((sum, s) => sum + (s.monthSummary?.totalHours ?? 0), 0)
    const totalSalary = staff.reduce((sum, s) => sum + (s.monthSummary?.calculatedSalary ?? 0), 0)
    const totalLeaves = staff.reduce((sum, s) => sum + (s.monthSummary?.totalLeaves ?? 0), 0)
    return {
      total: staff.length,
      active,
      totalHours: Math.round(totalHours * 100) / 100,
      totalSalary: Math.round(totalSalary),
      totalLeaves,
    }
  }, [staff])

  async function handleCreateEmployee(e: FormEvent) {
    e.preventDefault()
    if (creating) return
    const salary = Number(newMonthlySalary)
    if (!Number.isFinite(salary) || salary < 0) {
      toast({ message: 'Enter a valid monthly salary (0 or more)', tone: 'error' })
      return
    }
    setCreating(true)
    try {
      await api.createStaff({
        name: newName.trim(),
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        monthlySalary: salary,
        permissions: newPerms,
      })
      toast({ message: t('staff.added'), tone: 'success' })
      setAddOpen(false)
      setNewName('')
      setNewUsername('')
      setNewPassword('')
      setNewMonthlySalary('15000')
      setNewPerms({ ...DEFAULT_STAFF_PERMISSIONS })
      await loadStaff()
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not add employee',
        tone: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(member: StaffMember) {
    setBusyId(member.id)
    try {
      const res = await api.setStaffActive(member.id, !member.active)
      setStaff((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, active: res.staff.active } : m)),
      )
      if (details?.employee.id === member.id) {
        setDetails((prev) => (prev ? { ...prev, employee: { ...prev.employee, active: res.staff.active } } : prev))
      }
      toast({
        message: res.staff.active ? t('staff.enabledMsg') : t('staff.disabledMsg'),
        tone: 'success',
      })
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Update failed',
        tone: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleSaveSalary(e: FormEvent) {
    e.preventDefault()
    if (!details) return
    const salary = Number(salaryDraft)
    if (!Number.isFinite(salary) || salary < 0) {
      toast({ message: 'Enter a valid monthly salary', tone: 'error' })
      return
    }
    setSavingSalary(true)
    try {
      await api.updateStaffMonthlySalary(details.employee.id, salary)
      toast({ message: 'Monthly salary updated', tone: 'success' })
      await Promise.all([loadDetails(details.employee.id, month), loadStaff()])
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not update salary',
        tone: 'error',
      })
    } finally {
      setSavingSalary(false)
    }
  }

  async function handleMarkLogoutNow(sessionId: string) {
    if (!details) return
    try {
      await api.updateEmployeeSessionLogout(details.employee.id, sessionId, new Date().toISOString())
      toast({ message: 'Logout time recorded', tone: 'success' })
      await Promise.all([loadDetails(details.employee.id, month), loadStaff()])
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not update session',
        tone: 'error',
      })
    }
  }

  async function handleAddLeave(e: FormEvent) {
    e.preventDefault()
    if (!details || !leaveDate) return
    setSavingLeave(true)
    try {
      await api.addEmployeeLeave(details.employee.id, {
        leaveDate,
        leaveType,
        reason: leaveReason.trim() || undefined,
      })
      toast({ message: 'Leave recorded', tone: 'success' })
      setLeaveReason('')
      await Promise.all([loadDetails(details.employee.id, month), loadStaff()])
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not save leave',
        tone: 'error',
      })
    } finally {
      setSavingLeave(false)
    }
  }

  async function handleReviewLeave(userId: string, leaveId: string, status: 'approved' | 'rejected') {
    try {
      await api.reviewEmployeeLeave(userId, leaveId, status)
      toast({
        message: status === 'approved' ? 'Leave approved' : 'Leave rejected',
        tone: status === 'approved' ? 'success' : 'info',
      })
      const tasks: Promise<unknown>[] = [loadStaff()]
      if (details?.employee.id === userId) {
        tasks.push(loadDetails(userId, month))
      }
      await Promise.all(tasks)
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not update leave request',
        tone: 'error',
      })
    }
  }

  async function handleDeleteLeave(leaveId: string) {
    if (!details) return
    try {
      await api.deleteEmployeeLeave(details.employee.id, leaveId)
      toast({ message: 'Leave removed', tone: 'info' })
      await Promise.all([loadDetails(details.employee.id, month), loadStaff()])
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'Could not remove leave',
        tone: 'error',
      })
    }
  }

  return (
    <PullToRefresh onRefresh={loadStaff}>
      <div className="px-4 pb-6 pt-5 lg:px-8">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-navy-900 dark:text-white">
              {t('emp.title')}
            </h1>
            <p className="mt-0.5 text-sm text-navy-500 dark:text-navy-300">{t('emp.subtitle')}</p>
          </div>
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => setAddOpen(true)}
            className="min-h-[42px] px-4 text-sm"
          >
            {t('emp.add')}
          </Button>
        </header>

        <section className="surface p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-navy-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${t('common.search')}...`}
                className="h-11 w-full rounded-xl border border-navy-200 bg-white pl-10 pr-3 text-sm text-navy-900 outline-none focus:border-[#1868FE] dark:border-white/15 dark:bg-navy-900 dark:text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="sr-only">{t('emp.month')}</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-sm font-medium text-navy-900 outline-none focus:border-[#1868FE] dark:border-white/15 dark:bg-navy-900 dark:text-white"
              />
            </label>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            icon={Users}
            tone="blue"
            label={t('emp.totalEmployees')}
            value={String(totals.total)}
            sub={`${totals.active} ${t('status.active').toLowerCase()}`}
          />
          <MetricCard
            icon={Clock}
            tone="amber"
            label={t('emp.totalHours')}
            value={`${totals.totalHours} h`}
            sub={month}
          />
          <MetricCard
            icon={IndianRupee}
            tone="green"
            label={t('emp.totalSalary')}
            value={formatMoney(totals.totalSalary, lang)}
            sub={month}
          />
          <MetricCard
            icon={CalendarOff}
            tone="red"
            label={t('emp.totalLeaves')}
            value={`${totals.totalLeaves}`}
            sub={pendingRequests.length > 0 ? `${pendingRequests.length} ${t('emp.pending').toLowerCase()}` : month}
          />
        </div>

        {pendingRequests.length > 0 && (
          <section className="surface mt-4 p-4" aria-labelledby="pending-leaves-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="pending-leaves-title" className="text-base font-semibold text-navy-900 dark:text-white">
                {t('emp.pendingRequests')}
              </h2>
              <Badge tone="warning">{pendingRequests.length}</Badge>
            </div>
            <div className="mt-3 divide-y divide-navy-100 rounded-2xl border border-navy-100 dark:divide-white/10 dark:border-white/10">
              {pendingRequests.map((reqItem) => (
                <div key={reqItem.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={reqItem.employeeName} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-navy-900 dark:text-white">{reqItem.employeeName}</p>
                        <span className="font-mono text-xs text-navy-500 dark:text-navy-300">
                          @{reqItem.employeeUsername}
                        </span>
                        <Badge tone={reqItem.leaveType === 'half' ? 'warning' : 'amber'}>
                          {reqItem.leaveType === 'half' ? t('emp.halfDay') : t('emp.fullDay')}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-navy-600 dark:text-navy-300">
                        {reqItem.leaveDate}
                        {reqItem.reason ? ` · ${reqItem.reason}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      icon={Check}
                      onClick={() => void handleReviewLeave(reqItem.userId, reqItem.id, 'approved')}
                      className="min-h-[36px] px-3 py-1.5 text-xs"
                    >
                      {t('emp.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      icon={X}
                      onClick={() => void handleReviewLeave(reqItem.userId, reqItem.id, 'rejected')}
                      className="min-h-[36px] px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400"
                    >
                      {t('emp.reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="surface mt-4 p-4" aria-labelledby="employees-table-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="employees-table-title" className="text-base font-semibold text-navy-900 dark:text-white">
              {t('emp.title')}
            </h2>
            <Badge tone="neutral">{filteredStaff.length}</Badge>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-navy-400 dark:text-navy-300">{t('common.loading')}</p>
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('emp.noEmployees')}
              body={t('emp.subtitle')}
              action={
                <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)} className="min-h-[40px] px-4 text-sm">
                  {t('emp.add')}
                </Button>
              }
            />
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-navy-100 dark:border-white/10">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-50/70 text-[11px] font-semibold uppercase tracking-wider text-navy-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-navy-300">
                    <th className="px-3.5 py-2.5">{t('common.name')}</th>
                    <th className="px-3 py-2.5">{t('reports.filterStatus')}</th>
                    <th className="px-3 py-2.5">{t('emp.monthlySalary')}</th>
                    <th className="px-3 py-2.5">{t('emp.lastActivity')}</th>
                    <th className="px-3 py-2.5">{t('emp.hoursWorked')}</th>
                    <th className="px-3 py-2.5">{t('emp.leaves')}</th>
                    <th className="px-3 py-2.5 text-right">{t('emp.salary')}</th>
                    <th className="px-3.5 py-2.5 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100 dark:divide-white/10">
                  {filteredStaff.map((member) => {
                    const ms = member.monthSummary
                    return (
                      <tr
                        key={member.id}
                        className="transition-colors hover:bg-navy-50/70 dark:hover:bg-white/[0.04]"
                      >
                        <td className="px-3.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => setDetailId(member.id)}
                            className="flex items-center gap-2.5 text-left"
                          >
                            <Avatar name={member.name} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-navy-900 dark:text-white">{member.name}</p>
                              <p className="font-mono text-[11px] text-navy-500 dark:text-navy-300">
                                @{member.username}
                              </p>
                            </div>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={member.active ? 'success' : 'danger'}>
                              {member.active ? t('staff.active') : t('staff.disabled')}
                            </Badge>
                            {ms?.isOnline && <Badge tone="amber">{t('emp.onlineNow')}</Badge>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-navy-700 dark:text-navy-200">
                          {formatMoney(member.monthlySalary ?? 0, lang)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-navy-600 dark:text-navy-300">
                          {ms?.lastLoginAt ? (
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                <LogIn className="h-3 w-3" aria-hidden="true" />
                                {formatDateShort(ms.lastLoginAt, lang)} · {formatTime(ms.lastLoginAt, lang)}
                              </p>
                              <p className="flex items-center gap-1 text-navy-500 dark:text-navy-300">
                                <LogOut className="h-3 w-3" aria-hidden="true" />
                                {ms.lastLogoutAt
                                  ? `${formatDateShort(ms.lastLogoutAt, lang)} · ${formatTime(ms.lastLogoutAt, lang)}`
                                  : ms.isOnline
                                    ? t('emp.onlineNow')
                                    : '—'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-navy-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 dark:text-navy-100">
                          {ms ? `${ms.totalHours} h (${ms.daysWorked}d)` : '0 h'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <div className="inline-flex items-center gap-1">
                            <Badge tone={(ms?.totalLeaves ?? 0) > 0 ? 'warning' : 'neutral'}>
                              {ms?.totalLeaves ?? 0} d
                            </Badge>
                            {(ms?.pendingLeaves ?? 0) > 0 && (
                              <Badge tone="amber">{ms!.pendingLeaves} {t('emp.pending').toLowerCase()}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold text-navy-900 dark:text-white">
                          {formatMoney(ms?.calculatedSalary ?? 0, lang)}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              icon={Eye}
                              onClick={() => setDetailId(member.id)}
                              className="min-h-[36px] px-3 py-1.5 text-xs"
                            >
                              {t('common.details')}
                            </Button>
                            {role === 'owner' && (
                              <Button
                                variant="ghost"
                                icon={ShieldCheck}
                                onClick={() => {
                                  setRightsMember(member)
                                  setRightsDraft({ ...member.permissions })
                                }}
                                className="min-h-[36px] px-3 py-1.5 text-xs"
                              >
                                {t('staff.rights')}
                              </Button>
                            )}
                            {role === 'owner' && (
                              <Button
                                variant="quiet"
                                disabled={busyId === member.id}
                                onClick={() => void handleToggleActive(member)}
                                className="min-h-[36px] px-3 py-1.5 text-xs"
                              >
                                {member.active ? (
                                  <UserX className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                )}
                                {member.active ? t('staff.disable') : t('staff.enable')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Add employee modal */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t('emp.add')}>
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <TextInput
            label={t('staff.fullName')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Arjun Rathod"
            required
          />
          <TextInput
            label={t('staff.username')}
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="e.g. arjun"
            required
          />
          <TextInput
            label={t('staff.password')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
            minLength={8}
          />
          <TextInput
            label={t('emp.monthlySalary')}
            type="number"
            min={0}
            step="1"
            value={newMonthlySalary}
            onChange={(e) => setNewMonthlySalary(e.target.value)}
            required
          />

          <div className="rounded-2xl border border-navy-100 p-3 dark:border-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-500 dark:text-navy-300">
              {t('staff.rightsTitle')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSION_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-navy-50/70 px-2.5 py-2 text-xs font-medium text-navy-800 dark:bg-white/[0.04] dark:text-navy-100"
                >
                  <input
                    type="checkbox"
                    checked={newPerms[item.key]}
                    onChange={(e) => setNewPerms((prev) => toggleStaffPermission(prev, item.key, e.target.checked))}
                    className="h-4 w-4 rounded border-navy-300 text-[#1868FE]"
                  />
                  <span className="truncate">{t(item.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? t('common.loading') : t('emp.add')}
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Employee detail & payroll fullscreen sheet */}
      <Sheet
        open={Boolean(detailId)}
        onClose={() => {
          setDetailId(null)
          setDetails(null)
        }}
        title={details ? `${details.employee.name} (@${details.employee.username})` : t('emp.detailsTitle')}
        desktopFullscreen
      >
        {detailLoading || !details ? (
          <p className="py-12 text-center text-sm text-navy-400 dark:text-navy-300">{t('common.loading')}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-navy-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <Avatar name={details.employee.name} size="md" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-navy-900 dark:text-white">{details.employee.name}</h3>
                    <Badge tone={details.employee.active ? 'success' : 'danger'}>
                      {details.employee.active ? t('staff.active') : t('staff.disabled')}
                    </Badge>
                    {details.summary.isOnline && <Badge tone="amber">{t('emp.onlineNow')}</Badge>}
                  </div>
                  <p className="font-mono text-xs text-navy-500 dark:text-navy-300">
                    @{details.employee.username} · {formatMoney(details.employee.monthlySalary, lang)} −{' '}
                    {formatMoney(details.summary.leaveDeduction, lang)} ({details.summary.totalLeaves}d) ={' '}
                    <span className="font-bold text-navy-900 dark:text-white">
                      {formatMoney(details.summary.calculatedSalary, lang)}
                    </span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSalary} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500 dark:text-navy-300">
                    {t('emp.monthlySalary')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={salaryDraft}
                    onChange={(e) => setSalaryDraft(e.target.value)}
                    className="h-10 w-36 rounded-xl border border-navy-200 bg-white px-3 font-mono text-sm font-semibold text-navy-900 outline-none focus:border-[#1868FE] dark:border-white/15 dark:bg-navy-900 dark:text-white"
                  />
                </label>
                <Button type="submit" variant="primary" disabled={savingSalary} className="min-h-[40px] px-4 text-sm">
                  {savingSalary ? t('common.loading') : t('emp.saveSalary')}
                </Button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                icon={Clock}
                tone="amber"
                label={t('emp.hoursWorked')}
                value={`${details.summary.totalHours} h`}
                sub={formatDuration(details.summary.totalMinutes)}
              />
              <MetricCard
                icon={UserCheck}
                tone="blue"
                label={t('emp.daysWorked')}
                value={String(details.summary.daysWorked)}
                sub={`${details.summary.sessionsCount} shifts`}
              />
              <MetricCard
                icon={CalendarOff}
                tone="red"
                label={t('emp.totalLeaves')}
                value={String(details.summary.totalLeaves)}
                sub={`${t('emp.leaveDeduction')}: ${formatMoney(details.summary.leaveDeduction, lang)}`}
              />
              <MetricCard
                icon={IndianRupee}
                tone="green"
                label={t('emp.salary')}
                value={formatMoney(details.summary.calculatedSalary, lang)}
                sub={`${formatMoney(details.employee.monthlySalary, lang)} / ${details.summary.daysInMonth}d`}
              />
            </div>

            <section className="rounded-2xl border border-navy-100 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-navy-900 dark:text-white">{t('emp.attendanceTitle')}</h4>
                <Badge tone="neutral">{details.sessions.length}</Badge>
              </div>
              {details.sessions.length === 0 ? (
                <p className="py-6 text-center text-sm text-navy-400 dark:text-navy-300">{t('emp.noSessions')}</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-navy-100 dark:border-white/10">
                  <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 bg-navy-50/70 text-[11px] font-semibold uppercase tracking-wider text-navy-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-navy-300">
                        <th className="px-3 py-2">{t('common.date')}</th>
                        <th className="px-3 py-2">{t('emp.loginTime')}</th>
                        <th className="px-3 py-2">{t('emp.logoutTime')}</th>
                        <th className="px-3 py-2 text-right">{t('emp.duration')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100 dark:divide-white/10">
                      {details.sessions.map((s) => (
                        <tr key={s.id}>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-navy-700 dark:text-navy-200">
                            {formatDateShort(s.loginAt, lang)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                            {formatTime(s.loginAt, lang)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-navy-700 dark:text-navy-200">
                            {s.logoutAt ? (
                              formatTime(s.logoutAt, lang)
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <Badge tone="amber">{t('emp.onlineNow')}</Badge>
                                <button
                                  type="button"
                                  onClick={() => void handleMarkLogoutNow(s.id)}
                                  className="text-[11px] font-semibold text-[#1868FE] underline"
                                >
                                  {t('emp.markLogout')}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs font-semibold text-navy-800 dark:text-navy-100">
                            {formatDuration(s.durationMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-navy-100 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-navy-900 dark:text-white">{t('emp.leavesTitle')}</h4>
                <Badge tone="warning">{details.summary.totalLeaves} d</Badge>
              </div>

              <form onSubmit={handleAddLeave} className="mt-3 grid gap-2.5 sm:grid-cols-[160px_150px_1fr_auto]">
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
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder={t('emp.reason')}
                  className="h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-[#1868FE] dark:border-white/15 dark:bg-navy-900 dark:text-white"
                />
                <Button type="submit" variant="primary" icon={Plus} disabled={savingLeave} className="min-h-[40px] px-4 text-sm">
                  {t('emp.markLeave')}
                </Button>
              </form>

              {details.leaves.length === 0 ? (
                <p className="py-5 text-center text-sm text-navy-400 dark:text-navy-300">{t('emp.noLeaves')}</p>
              ) : (
                <ul className="mt-3 divide-y divide-navy-100 rounded-xl border border-navy-100 dark:divide-white/10 dark:border-white/10">
                  {details.leaves.map((lv) => (
                    <li key={lv.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
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
                      <div className="flex items-center gap-1.5">
                        {lv.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              icon={Check}
                              onClick={() => void handleReviewLeave(details.employee.id, lv.id, 'approved')}
                              className="min-h-[32px] px-2.5 py-1 text-xs"
                            >
                              {t('emp.approve')}
                            </Button>
                            <Button
                              variant="ghost"
                              icon={X}
                              onClick={() => void handleReviewLeave(details.employee.id, lv.id, 'rejected')}
                              className="min-h-[32px] px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400"
                            >
                              {t('emp.reject')}
                            </Button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteLeave(lv.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Sheet>
      <Sheet
        open={Boolean(rightsMember)}
        onClose={() => (savingRights ? undefined : setRightsMember(null))}
        title={rightsMember ? `${rightsMember.name} · ${t('staff.rightsTitle')}` : t('staff.rightsTitle')}
        subtitle={rightsMember ? `@${rightsMember.username}` : undefined}
        footer={
          <Button
            full
            loading={savingRights}
            onClick={async () => {
              if (!rightsMember) return
              setSavingRights(true)
              try {
                const res = await api.updateStaffPermissions(rightsMember.id, rightsDraft)
                setStaff((prev) => prev.map((m) => (m.id === rightsMember.id ? { ...m, permissions: res.staff.permissions } : m)))
                setRightsMember(null)
                toast({ message: t('staff.rightsSaved'), tone: 'success' })
              } catch (error) {
                toast({ message: error instanceof Error ? error.message : t('toast.error'), tone: 'error' })
              } finally {
                setSavingRights(false)
              }
            }}
            icon={Check}
            className="min-h-[48px]"
          >
            {t('action.save')}
          </Button>
        }
      >
        <div className="space-y-2">
          {PERMISSION_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900 dark:text-white">{t(item.labelKey)}</p>
                <p className="text-[11px] text-navy-500 dark:text-navy-300">{t(item.descKey)}</p>
              </div>
              <input
                type="checkbox"
                checked={rightsDraft[item.key]}
                onChange={() => setRightsDraft((prev) => toggleStaffPermission(prev, item.key, !prev[item.key]))}
                className="h-4 w-4 accent-[#1868FE]"
              />
            </label>
          ))}
        </div>
      </Sheet>
    </PullToRefresh>
  )
}

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof Clock
  tone: 'blue' | 'amber' | 'green' | 'red'
  label: string
  value: string
  sub?: string
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        : tone === 'red'
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
          : 'bg-blue-50 text-[#1868FE] dark:bg-blue-500/15 dark:text-blue-300'

  return (
    <div className="surface p-4">
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', toneClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2.5 text-xs font-medium text-navy-500 dark:text-navy-300">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-bold text-navy-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-navy-400 dark:text-navy-300">{sub}</p>}
    </div>
  )
}
