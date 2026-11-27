import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react'
import { useData } from '@/state/DataContext'
import { useSettings } from '@/state/SettingsContext'
import { useToast } from '@/state/ToastContext'
import { Avatar, Badge, Button, EmptyState, ListSkeleton } from '@/components/ui'
import { BulkWhatsappSenderModal } from '@/components/BulkWhatsappSenderModal'
import {
  buildWhatsappClickToChatUrl,
  buildWhatsappTemplate,
  classifyExpiryWindow,
  formatWhatsappPhone,
  getExpiryDaysRemaining,
  type WhatsappCustomerItem,
} from '@/lib/whatsappReminders'
import { formatDate, formatPlate } from '@/lib/utils'
import type { ReminderRecord } from '@/types'

type FilterTab = 'all' | 'expiring' | '3_days' | '1_day' | 'today' | 'expired'

export default function WhatsappRemindersPage() {
  const { passes, reminders, ready, refresh } = useData()
  const { settings, lang } = useSettings()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [selectedPassIds, setSelectedPassIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Map reminders by passId + endDate + reminderType
  const reminderStatusMap = useMemo(() => {
    const map = new Map<string, ReminderRecord>()
    for (const r of reminders) {
      const key = `${r.passId}__${r.endDate}__${r.reminderType ?? 'expiring'}`
      // latest one wins
      if (!map.has(key) || new Date(r.at).getTime() > new Date(map.get(key)!.at).getTime()) {
        map.set(key, r)
      }
    }
    return map
  }, [reminders])

  // Identify all customers who are Expiring (<=3 days) or Expired
  const allEligibleCustomers = useMemo<WhatsappCustomerItem[]>(() => {
    const now = new Date()
    const items: WhatsappCustomerItem[] = []

    for (const pass of passes) {
      const daysRemaining = getExpiryDaysRemaining(pass.endDate, now)
      const windowType = classifyExpiryWindow(daysRemaining)
      if (!windowType) continue // Not in the target window (> 3 days)

      const formattedPhone = formatWhatsappPhone(pass.phone)
      const phoneValid = formattedPhone !== null
      const message = buildWhatsappTemplate(pass, windowType, settings.siteName, lang)
      const waUrl = phoneValid ? buildWhatsappClickToChatUrl(pass.phone, message) : null

      items.push({
        pass,
        windowType,
        daysRemaining,
        phoneValid,
        formattedPhone: formattedPhone || pass.phone,
        message,
        waUrl,
      })
    }

    // Sort by daysRemaining ascending (expired/today first, then 1 day, 3 days)
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [passes, settings.siteName, lang])

  // Filter based on search & active tab
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allEligibleCustomers.filter((item) => {
      // Tab filter
      if (activeTab === 'expiring' && item.windowType === 'expired') return false
      if (activeTab === '3_days' && item.windowType !== '3_days') return false
      if (activeTab === '1_day' && item.windowType !== '1_day') return false
      if (activeTab === 'today' && item.windowType !== 'today') return false
      if (activeTab === 'expired' && item.windowType !== 'expired') return false

      // Search query
      if (!q) return true
      const plate = item.pass.vehicle.toLowerCase()
      const name = item.pass.name.toLowerCase()
      const phone = item.pass.phone
      return name.includes(q) || plate.includes(q) || phone.includes(q)
    })
  }, [allEligibleCustomers, activeTab, search])

  // Metric counts
  const metrics = useMemo(() => {
    let expiringCount = 0
    let todayCount = 0
    let tomorrowCount = 0
    let expiredCount = 0
    let sentCount = 0
    let pendingCount = 0

    for (const item of allEligibleCustomers) {
      if (item.windowType === 'expired') expiredCount += 1
      else {
        expiringCount += 1
        if (item.windowType === 'today') todayCount += 1
        if (item.windowType === '1_day') tomorrowCount += 1
      }

      const key = `${item.pass.id}__${item.pass.endDate}__${item.windowType}`
      const rec = reminderStatusMap.get(key)
      if (rec?.status === 'sent') sentCount += 1
      else pendingCount += 1
    }

    return {
      totalExpiring: expiringCount,
      totalExpired: expiredCount,
      totalEligible: allEligibleCustomers.length,
      todayCount,
      tomorrowCount,
      sentCount,
      pendingCount,
    }
  }, [allEligibleCustomers, reminderStatusMap])

  // Bulk Selection Handlers
  const toggleSelectAll = () => {
    if (selectedPassIds.size === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedPassIds(new Set())
    } else {
      setSelectedPassIds(new Set(filteredCustomers.map((c) => c.pass.id)))
    }
  }

  const selectOnlyExpiring = () => {
    const expiringOnly = filteredCustomers.filter((c) => c.windowType !== 'expired').map((c) => c.pass.id)
    setSelectedPassIds(new Set(expiringOnly))
  }

  const toggleSelectOne = (id: string) => {
    setSelectedPassIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Selected items prepared for sender modal
  const selectedItemsToSend = useMemo(() => {
    return allEligibleCustomers.filter((item) => selectedPassIds.has(item.pass.id) && item.phoneValid)
  }, [allEligibleCustomers, selectedPassIds])

  const handleStartBulkSender = () => {
    if (selectedItemsToSend.length === 0) {
      toast({ message: 'Please select at least one customer with a valid phone number', tone: 'error' })
      return
    }
    setModalOpen(true)
  }

  const handleSingleQuickSend = (item: WhatsappCustomerItem) => {
    if (!item.waUrl) {
      toast({ message: 'Invalid customer phone number', tone: 'error' })
      return
    }
    window.open(item.waUrl, '_blank', 'noopener,noreferrer')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
      toast({ message: 'Refreshed pass and reminder data', tone: 'success' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="px-page py-4 lg:mx-auto lg:max-w-7xl lg:py-7">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#16A34A] dark:bg-[#25D366]/20">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-navy-900 dark:text-white">
                WhatsApp Expiry Reminders
              </h1>
              <p className="text-xs text-navy-500 dark:text-navy-300">
                Send 100% free individual WhatsApp Click-to-Chat expiry reminders with pre-filled templates.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleRefresh}
            loading={refreshing}
            icon={RefreshCw}
            className="h-10 px-3 text-xs"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={handleStartBulkSender}
            disabled={selectedItemsToSend.length === 0}
            icon={Send}
            className="h-10 bg-[#25D366] text-white hover:bg-[#20ba59] active:bg-[#1da850]"
          >
            Send WhatsApp Reminders ({selectedItemsToSend.length})
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {/* Total Expiring */}
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
          <div className="flex items-center justify-between text-navy-500 dark:text-navy-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring Passes</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 dark:text-white">{metrics.totalExpiring}</p>
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            {metrics.todayCount} today · {metrics.tomorrowCount} tomorrow
          </p>
        </div>

        {/* Selected Customers */}
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
          <div className="flex items-center justify-between text-navy-500 dark:text-navy-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Selected Customers</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 dark:text-white">{selectedPassIds.size}</p>
          <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">
            of {filteredCustomers.length} in current view
          </p>
        </div>

        {/* Reminders Sent (Confirmed) */}
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
          <div className="flex items-center justify-between text-navy-500 dark:text-navy-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Confirmed Sent</span>
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#16A34A]">{metrics.sentCount}</p>
          <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">Admin-confirmed</p>
        </div>

        {/* Pending Reminders */}
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
          <div className="flex items-center justify-between text-navy-500 dark:text-navy-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Reminders</span>
            <ShieldAlert className="h-4 w-4 text-navy-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 dark:text-white">{metrics.pendingCount}</p>
          <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">Awaiting contact</p>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              placeholder="Search by customer name, vehicle, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-navy-200 bg-white py-2 pl-10 pr-10 text-sm text-navy-900 placeholder:text-navy-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Selection Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={toggleSelectAll} className="h-9 px-3 text-xs">
              {selectedPassIds.size === filteredCustomers.length && filteredCustomers.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </Button>
            <Button variant="ghost" onClick={selectOnlyExpiring} className="h-9 px-3 text-xs">
              Select Only Expiring
            </Button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3 dark:border-white/10">
          {[
            { id: 'all', label: `All (${allEligibleCustomers.length})` },
            { id: 'expiring', label: `All Expiring (${metrics.totalExpiring})` },
            { id: 'today', label: `Today (${metrics.todayCount})` },
            { id: '1_day', label: `Tomorrow (${metrics.tomorrowCount})` },
            { id: '3_days', label: 'In 3 Days' },
            { id: 'expired', label: `Expired (${metrics.totalExpired})` },
          ].map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-900'
                    : 'bg-navy-50 text-navy-600 hover:bg-navy-100 dark:bg-white/5 dark:text-navy-300 dark:hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Customer Reminders Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm dark:border-white/10 dark:bg-navy-900">
        {!ready ? (
          <div className="p-4">
            <ListSkeleton rows={6} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CheckCircle2}
              title="No Customers Due for Reminders"
              body="No parking passes matched your active filter or search criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/70 text-[11px] font-bold uppercase tracking-wider text-navy-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-navy-300">
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all customers"
                      checked={selectedPassIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-navy-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">WhatsApp Number</th>
                  <th className="px-4 py-3">Vehicle Number</th>
                  <th className="px-4 py-3">Pass Type</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3 text-center">Days Remaining</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 dark:divide-white/10">
                {filteredCustomers.map((item) => {
                  const pass = item.pass
                  const selected = selectedPassIds.has(pass.id)
                  const reminderKey = `${pass.id}__${pass.endDate}__${item.windowType}`
                  const lastReminder = reminderStatusMap.get(reminderKey)

                  return (
                    <tr
                      key={pass.id}
                      className={`transition-colors hover:bg-navy-50/50 dark:hover:bg-white/[0.02] ${
                        selected ? 'bg-blue-50/40 dark:bg-blue-500/[0.04]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${pass.name}`}
                          checked={selected}
                          onChange={() => toggleSelectOne(pass.id)}
                          className="h-4 w-4 rounded border-navy-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Customer Name */}
                      <td className="px-4 py-3 font-semibold text-navy-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Avatar name={pass.name} photo={pass.photo} size="sm" />
                          <span className="truncate">{pass.name}</span>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="px-4 py-3 font-mono text-navy-600 dark:text-navy-300">
                        {item.phoneValid ? (
                          <span>+{item.formattedPhone}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Invalid ({pass.phone || 'Missing'})
                          </span>
                        )}
                      </td>

                      {/* Vehicle Number */}
                      <td className="px-4 py-3 font-mono font-semibold text-navy-700 dark:text-navy-200">
                        {formatPlate(pass.vehicle)}
                      </td>

                      {/* Pass Type */}
                      <td className="px-4 py-3 uppercase text-navy-600 dark:text-navy-300">
                        <span className="rounded-md bg-navy-100 px-2 py-0.5 text-[10px] font-bold dark:bg-white/10">
                          {pass.plan}
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="px-4 py-3 font-mono text-navy-600 dark:text-navy-300">
                        {formatDate(pass.endDate, lang)}
                      </td>

                      {/* Days Remaining Badge */}
                      <td className="px-4 py-3 text-center">
                        {item.windowType === 'expired' ? (
                          <Badge tone="danger">Expired ({Math.abs(item.daysRemaining)}d ago)</Badge>
                        ) : item.windowType === 'today' ? (
                          <Badge tone="amber">Expiring Today</Badge>
                        ) : item.windowType === '1_day' ? (
                          <Badge tone="warning">1 Day (Tomorrow)</Badge>
                        ) : (
                          <Badge tone="neutral">{item.daysRemaining} Days Left</Badge>
                        )}
                      </td>

                      {/* Notification Status */}
                      <td className="px-4 py-3 text-center">
                        {lastReminder?.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <Check className="h-3 w-3" /> Sent
                          </span>
                        ) : lastReminder?.status === 'opened' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                            Opened
                          </span>
                        ) : lastReminder?.status === 'skipped' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 px-2.5 py-0.5 text-[11px] font-semibold text-navy-600 dark:bg-white/10 dark:text-navy-300">
                            Skipped
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-0.5 text-[11px] font-semibold text-navy-400 dark:bg-white/5">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSingleQuickSend(item)}
                          disabled={!item.phoneValid}
                          icon={MessageCircle}
                          className="h-8 px-2.5 text-xs text-[#16A34A] hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          Chat
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Processing Modal */}
      <BulkWhatsappSenderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={selectedItemsToSend}
        onComplete={() => {
          setSelectedPassIds(new Set())
          void refresh()
        }}
      />
    </div>
  )
}
