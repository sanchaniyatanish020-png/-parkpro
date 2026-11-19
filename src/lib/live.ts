import { API_BASE, api } from './api'

/** Fallback cadence while the stream is unavailable and the tab is visible. */
const POLL_MS = 20_000
const RETRY_MS = 30_000
const MIN_GAP_MS = 1_500

interface LiveOptions {
  onChange: () => void
  isOnline: () => boolean
}

/**
 * Server-Sent Events with a polling fallback (proxies sometimes block streams).
 * Listeners are only notified while the tab is visible; hidden tabs catch up on
 * the visibilitychange event.
 */
export function startLiveUpdates({ onChange, isOnline }: LiveOptions): () => void {
  let stopped = false
  let connecting = false
  let source: EventSource | null = null
  let pollTimer: number | null = null
  let retryTimer: number | null = null
  let changeTimer: number | null = null
  let lastChange = 0

  const emit = () => {
    if (stopped || !isOnline() || document.visibilityState !== 'visible') return
    const wait = MIN_GAP_MS - (Date.now() - lastChange)
    if (wait <= 0) {
      lastChange = Date.now()
      onChange()
    } else if (changeTimer == null) {
      changeTimer = window.setTimeout(() => {
        changeTimer = null
        lastChange = Date.now()
        onChange()
      }, wait)
    }
  }

  const startPolling = () => {
    if (pollTimer != null) return
    pollTimer = window.setInterval(emit, POLL_MS)
  }

  const stopPolling = () => {
    if (pollTimer == null) return
    window.clearInterval(pollTimer)
    pollTimer = null
  }

  const closeSource = () => {
    if (!source) return
    source.close()
    source = null
  }

  const scheduleRetry = () => {
    if (stopped || retryTimer != null) return
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      void connect()
    }, RETRY_MS)
  }

  const connect = async () => {
    if (stopped || connecting) return
    if (retryTimer != null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
    connecting = true
    // Keep polling until the stream is confirmed open.
    startPolling()
    try {
      const { ticket } = await api.eventTicket()
      if (stopped) return
      const events = new EventSource(`${API_BASE}/events?ticket=${encodeURIComponent(ticket)}`)
      source = events
      events.addEventListener('open', () => {
        if (source === events) stopPolling()
      })
      events.addEventListener('change', emit)
      events.addEventListener('error', () => {
        if (source !== events) return
        if (events.readyState !== EventSource.CLOSED) return
        closeSource()
        startPolling()
        scheduleRetry()
      })
    } catch {
      startPolling()
      scheduleRetry()
    } finally {
      connecting = false
    }
  }

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    emit()
    if (!source) void connect()
  }

  const onOnline = () => void connect()
  const onOffline = () => {
    closeSource()
    startPolling()
  }

  void connect()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  return () => {
    stopped = true
    closeSource()
    stopPolling()
    if (retryTimer != null) window.clearTimeout(retryTimer)
    if (changeTimer != null) window.clearTimeout(changeTimer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
