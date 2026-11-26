import { useCallback, useEffect, useId, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import {
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
} from 'lucide-react'
import type { StaffPermissions } from '@/types'
import { api, type StaffMember } from '@/lib/api'
import {
  ALL_PERMISSIONS,
  countGrantedPermissions,
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_ITEMS,
  STAFF_PERMISSION_KEYS,
  toggleStaffPermission,
} from '@/lib/permissions'
import { Avatar, Badge, Button, TextInput, Toggle } from '@/components/ui'
import { Sheet } from '@/components/Sheet'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

export function StaffTeamSection({ online }: { online: boolean }) {
  const { t } = useSettings()
  const { toast } = useToast()
  const formId = useId()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPermissions, setNewPermissions] = useState<StaffPermissions>(() => ({ ...DEFAULT_STAFF_PERMISSIONS }))
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [rightsMember, setRightsMember] = useState<StaffMember | null>(null)
  const [draftRights, setDraftRights] = useState<StaffPermissions>(() => ({ ...DEFAULT_STAFF_PERMISSIONS }))
  const [savingRights, setSavingRights] = useState(false)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await api.listStaff()
      setStaff(data.staff)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t('settings.staffLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!online && staff.length > 0) return
    void loadStaff()
    // Load staff accounts on mount and whenever connectivity returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const openAddModal = () => {
    setName('')
    setUsername('')
    setPassword('')
    setNewPermissions({ ...DEFAULT_STAFF_PERMISSIONS })
    setShowPassword(false)
    setFormError('')
    setAddOpen(true)
  }

  const openRightsModal = (member: StaffMember) => {
    setRightsMember(member)
    setDraftRights({ ...member.permissions })
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    const cleanName = name.trim()
    const cleanUsername = username.trim().toLowerCase()

    if (cleanName.length < 2) {
      setFormError(t('settings.staffNameError'))
      return
    }
    if (!USERNAME_RE.test(cleanUsername)) {
      setFormError(t('settings.staffUsernameError'))
      return
    }
    if (password.trim().length < 8) {
      setFormError(t('settings.pinLength'))
      return
    }

    setSaving(true)
    try {
      const { staff: created } = await api.createStaff({
        name: cleanName,
        username: cleanUsername,
        password,
        permissions: newPermissions,
      })
      setStaff((prev) => [created, ...prev])
      setAddOpen(false)
      toast({ message: t('settings.staffAdded', { name: created.name }), tone: 'success' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (member: StaffMember) => {
    setTogglingId(member.id)
    try {
      const { staff: updated } = await api.setStaffActive(member.id, !member.active)
      setStaff((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast({
        message: t(updated.active ? 'settings.staffEnabledToast' : 'settings.staffDisabledToast', {
          name: updated.name,
        }),
        tone: updated.active ? 'success' : 'warning',
      })
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : t('toast.error'),
        tone: 'error',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleSaveRights = async () => {
    if (!rightsMember) return
    setSavingRights(true)
    try {
      const { staff: updated } = await api.updateStaffPermissions(rightsMember.id, draftRights)
      setStaff((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setRightsMember(null)
      toast({ message: t('settings.rightsSaved', { name: updated.name }), tone: 'success' })
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : t('toast.error'),
        tone: 'error',
      })
    } finally {
      setSavingRights(false)
    }
  }

  const activeCount = staff.filter((item) => item.active).length

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-900 dark:text-white">{t('settings.staffTeam')}</p>
          <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-300">
            {loading || loadError
              ? t('settings.staffTeamDesc')
              : t('settings.staffCount', { active: activeCount, total: staff.length })}
          </p>
        </div>
        <Button
          variant="primary"
          icon={UserPlus}
          disabled={!online}
          onClick={openAddModal}
          className="min-h-[42px] shrink-0 px-3.5 text-xs"
        >
          {t('settings.addStaff')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-navy-400 dark:text-navy-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{t('common.loading')}</span>
        </div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-3 py-3">
          <p className="text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5]">{loadError}</p>
          <Button variant="ghost" onClick={() => void loadStaff()} className="min-h-[38px] shrink-0 px-3 text-xs">
            {t('action.retry')}
          </Button>
        </div>
      ) : staff.length === 0 ? (
        <p className="py-4 text-xs text-navy-400 dark:text-navy-300">{t('settings.staffEmpty')}</p>
      ) : (
        staff.map((member) => {
          const granted = countGrantedPermissions(member.permissions)
          return (
            <div key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={member.name} size="sm" className={member.active ? '' : 'opacity-50'} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p
                    className={
                      member.active
                        ? 'truncate text-sm font-semibold text-navy-900 dark:text-white'
                        : 'truncate text-sm font-semibold text-navy-400 line-through dark:text-navy-400'
                    }
                  >
                    {member.name}
                  </p>
                  <Badge tone={member.active ? 'success' : 'danger'}>
                    {member.active ? t('settings.staffActive') : t('settings.staffDisabled')}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-300">
                  <span className="font-mono">@{member.username}</span> ·{' '}
                  {t('settings.rightsCount', { n: granted, total: STAFF_PERMISSION_KEYS.length })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  icon={ShieldCheck}
                  disabled={!online}
                  onClick={() => openRightsModal(member)}
                  aria-label={`${t('settings.rights')} ${member.name}`}
                  className="min-h-[40px] shrink-0 px-3 text-xs text-[#1868FE] dark:text-blue-300"
                >
                  {t('settings.rights')}
                </Button>
                <Button
                  variant="ghost"
                  icon={member.active ? UserX : UserCheck}
                  loading={togglingId === member.id}
                  disabled={!online || (togglingId !== null && togglingId !== member.id)}
                  onClick={() => void handleToggle(member)}
                  aria-label={`${member.active ? t('settings.disableStaff') : t('settings.enableStaff')} ${member.name}`}
                  className={
                    member.active
                      ? 'min-h-[40px] shrink-0 px-3 text-xs text-[#B91C1C] dark:text-[#FCA5A5]'
                      : 'min-h-[40px] shrink-0 px-3 text-xs text-[#15803D] dark:text-[#86EFAC]'
                  }
                >
                  {member.active ? t('settings.disableStaff') : t('settings.enableStaff')}
                </Button>
              </div>
            </div>
          )
        })
      )}

      <Sheet
        open={addOpen}
        onClose={() => (saving ? undefined : setAddOpen(false))}
        title={t('settings.addStaff')}
        subtitle={t('settings.addStaffSubtitle')}
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              full
              disabled={saving}
              onClick={() => setAddOpen(false)}
              className="min-h-[48px]"
            >
              {t('action.cancel')}
            </Button>
            <Button
              type="submit"
              form={formId}
              full
              loading={saving}
              icon={UserPlus}
              className="min-h-[48px]"
            >
              {t('settings.addStaff')}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={(event) => void handleCreate(event)} className="space-y-4">
          {formError && (
            <p className="rounded-xl bg-[#FEF2F2] px-3.5 py-2.5 text-sm font-medium text-[#991B1B] dark:bg-[#DC2626]/10 dark:text-[#FCA5A5]">
              {formError}
            </p>
          )}
          <TextInput
            label={t('settings.staffName')}
            required
            placeholder="Kiran Patel"
            icon={UserRound}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextInput
            label={t('settings.staffUsername')}
            required
            placeholder="kiran.gate"
            icon={AtSign}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            hint={t('settings.staffUsernameHint')}
            value={username}
            onChange={(event) => setUsername(event.target.value.replace(/\s+/g, '').toLowerCase())}
          />
          <div className="relative">
            <TextInput
              label={t('settings.staffPassword')}
              required
              type={showPassword ? 'text' : 'password'}
              icon={KeyRound}
              autoComplete="new-password"
              hint={t('settings.staffPasswordHint')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-[34px] flex h-10 w-10 items-center justify-center rounded-lg text-navy-400 hover:text-navy-700 dark:text-navy-300 dark:hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          <div className="border-t border-navy-100 pt-3 dark:border-white/10">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-navy-500 dark:text-navy-300">
              {t('settings.rightsTitle')}
            </p>
            <PermissionsMatrix value={newPermissions} onChange={setNewPermissions} />
          </div>
        </form>
      </Sheet>

      <Sheet
        open={Boolean(rightsMember)}
        onClose={() => (savingRights ? undefined : setRightsMember(null))}
        title={t('settings.rightsTitle')}
        subtitle={
          rightsMember
            ? t('settings.rightsSubtitle', { name: rightsMember.name, username: rightsMember.username })
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              full
              disabled={savingRights}
              onClick={() => setRightsMember(null)}
              className="min-h-[48px]"
            >
              {t('action.cancel')}
            </Button>
            <Button
              full
              loading={savingRights}
              icon={ShieldCheck}
              onClick={() => void handleSaveRights()}
              className="min-h-[48px]"
            >
              {t('settings.saveRights')}
            </Button>
          </div>
        }
      >
        <PermissionsMatrix value={draftRights} onChange={setDraftRights} />
      </Sheet>
    </>
  )
}

function PermissionsMatrix({
  value,
  onChange,
}: {
  value: StaffPermissions
  onChange: Dispatch<SetStateAction<StaffPermissions>>
}) {
  const { t } = useSettings()
  const gateItems = PERMISSION_ITEMS.filter((item) => item.group === 'gate')
  const adminItems = PERMISSION_ITEMS.filter((item) => item.group === 'admin')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => onChange(() => ({ ...DEFAULT_STAFF_PERMISSIONS }))}
          className="min-h-[38px] px-3 text-xs"
        >
          {t('settings.presetGateOnly')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onChange(() => ({ ...ALL_PERMISSIONS }))}
          className="min-h-[38px] px-3 text-xs"
        >
          {t('settings.presetFullAccess')}
        </Button>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
          {t('settings.rightsGroupGate')}
        </p>
        <div className="divide-y divide-navy-100 rounded-2xl border border-navy-100 px-3.5 dark:divide-white/10 dark:border-white/10">
          {gateItems.map((item) => (
            <Toggle
              key={item.key}
              checked={value[item.key]}
              onChange={(checked) => onChange((prev) => toggleStaffPermission(prev, item.key, checked))}
              label={t(item.labelKey)}
              description={t(item.descKey)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400 dark:text-navy-300">
          {t('settings.rightsGroupAdmin')}
        </p>
        <div className="divide-y divide-navy-100 rounded-2xl border border-navy-100 px-3.5 dark:divide-white/10 dark:border-white/10">
          {adminItems.map((item) => (
            <Toggle
              key={item.key}
              checked={value[item.key]}
              onChange={(checked) => onChange((prev) => toggleStaffPermission(prev, item.key, checked))}
              label={t(item.labelKey)}
              description={t(item.descKey)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
