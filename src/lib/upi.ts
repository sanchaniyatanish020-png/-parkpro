const VPA_PATTERN = /^[a-z0-9][a-z0-9._-]{0,60}@[a-z][a-z0-9.-]{1,30}$/

/** Accepts a plain VPA or a pasted upi:// payment link and returns a clean VPA. */
export function normalizeUpiId(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  const fromLink = value.match(/[?&]pa=([^&]+)/i)
  const candidate = fromLink ? decodeURIComponent(fromLink[1]) : value
  return candidate.replace(/\s+/g, '').toLowerCase()
}

export function isValidUpiId(value: string): boolean {
  return VPA_PATTERN.test(value.trim().toLowerCase())
}

export function buildUpiUri({
  vpa,
  payee,
  amount,
  note,
}: {
  vpa: string
  payee: string
  amount: number
  note?: string
}): string {
  const params = [`pa=${encodeURIComponent(vpa)}`, `pn=${encodeURIComponent(payee)}`, 'cu=INR']
  if (Number.isFinite(amount) && amount > 0) params.push(`am=${amount.toFixed(2)}`)
  const trimmedNote = note?.replace(/\s+/g, ' ').trim().slice(0, 50)
  if (trimmedNote) params.push(`tn=${encodeURIComponent(trimmedNote)}`)
  return `upi://pay?${params.join('&')}`
}
