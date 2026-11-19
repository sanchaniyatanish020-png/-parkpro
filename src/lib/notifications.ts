export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function showLocalNotification(title: string, body: string, tag: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, {
          body,
          tag,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: { url: '/' },
        })
        return
      }
    }
    new Notification(title, { body, icon: '/icons/icon-192.png', tag })
  } catch {
    /* notifications are best-effort */
  }
}
