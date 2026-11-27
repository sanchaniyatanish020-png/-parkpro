import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'

export function useQrDataUrl(value: string, size = 480): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!value) {
      setUrl('')
      return
    }
    QRCode.toDataURL(value, {
      width: size,
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((dataUrl) => {
        if (!cancelled) setUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [value, size])
  return url
}

export function QrImage({ value, className, size = 480 }: { value: string; className?: string; size?: number }) {
  const url = useQrDataUrl(value, size)
  if (!url) return <div className={cn('skeleton', className)} aria-hidden="true" />
  return (
    <img
      src={url}
      alt=""
      className={cn('block h-full w-full', className)}
      style={{ imageRendering: 'pixelated' }}
      width={size}
      height={size}
    />
  )
}
