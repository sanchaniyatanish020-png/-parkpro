import { downloadDataUrl } from '@/lib/utils'

export function callNumber(phone: string) {
  if (!phone) return
  window.location.href = `tel:+91${phone.replace(/\D/g, '').slice(-10)}`
}

export function openWhatsApp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  const to = digits.length === 10 ? `91${digits}` : digits
  const url = `https://wa.me/${to}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

export async function shareImage(dataUrl: string, filename: string, text: string): Promise<'shared' | 'downloaded'> {
  try {
    const file = dataUrlToFile(dataUrl, filename)
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean
      share?: (data?: ShareData) => Promise<void>
    }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text, title: 'ParkPro parking pass' })
      return 'shared'
    }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return 'shared'
  }
  downloadDataUrl(dataUrl, filename)
  return 'downloaded'
}

export async function shareText(text: string, title = 'ParkPro'): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text })
      return true
    }
  } catch {
    /* cancelled or unsupported */
  }
  return false
}
