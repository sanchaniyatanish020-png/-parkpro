import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { CarFront, CheckCircle2, Clock3, Loader2, Phone, XCircle, type LucideIcon } from 'lucide-react'
import { cn, initials, passStatus } from '@/lib/utils'
import type { Pass, PassStatus } from '@/types'
import { useSettings } from '@/state/SettingsContext'

/* --------------------------------- button --------------------------------- */

type ButtonVariant = 'primary' | 'navy' | 'success' | 'ghost' | 'danger' | 'quiet'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  full?: boolean
  loading?: boolean
  icon?: LucideIcon
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  navy: 'btn-navy',
  success: 'btn-success',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  quiet: 'btn text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-white/5',
}

export function Button({
  variant = 'primary',
  full,
  loading,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(VARIANTS[variant], full && 'w-full', className)}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

/* ---------------------------------- badge --------------------------------- */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'amber' | 'navy'

const BADGE_TONES: Record<BadgeTone, string> = {
  success: 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#16A34A]/15 dark:text-[#86EFAC]',
  warning: 'bg-[#FFEDD5] text-[#9A3412] dark:bg-[#F97316]/15 dark:text-[#FDBA74]',
  danger: 'bg-[#FEE2E2] text-[#991B1B] dark:bg-[#DC2626]/18 dark:text-[#FCA5A5]',
  neutral: 'bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-navy-100',
  amber: 'bg-blue-100 text-[#1E40AF] dark:bg-blue-500/20 dark:text-blue-300',
  navy: 'bg-navy-900 text-white dark:bg-white dark:text-navy-900',
}

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[26px] items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold leading-tight',
        BADGE_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  )
}

const STATUS_META: Record<PassStatus, { tone: BadgeTone; icon: LucideIcon; key: string }> = {
  active: { tone: 'success', icon: CheckCircle2, key: 'status.active' },
  expiring: { tone: 'warning', icon: Clock3, key: 'status.expiring' },
  expired: { tone: 'danger', icon: XCircle, key: 'status.expired' },
}

export function PassStatusBadge({ pass, className }: { pass: Pass; className?: string }) {
  const { t } = useSettings()
  const meta = STATUS_META[passStatus(pass)]
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {t(meta.key)}
    </Badge>
  )
}

export function StatusDot({ tone = 'success', label }: { tone?: 'success' | 'warning' | 'danger' | 'neutral'; label: string }) {
  const color =
    tone === 'success' ? 'bg-[#16A34A]' : tone === 'warning' ? 'bg-[#F97316]' : tone === 'danger' ? 'bg-[#DC2626]' : 'bg-navy-400'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={cn('h-2 w-2 rounded-full', color)} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

/* --------------------------------- avatar --------------------------------- */

export function Avatar({
  name,
  photo,
  size = 'md',
  className,
}: {
  name: string
  photo?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-2xl',
  }
  return photo ? (
    <img
      src={photo}
      alt={name}
      loading="lazy"
      className={cn('shrink-0 rounded-full object-cover', sizes[size], className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-display font-bold text-navy-700 dark:bg-white/10 dark:text-white',
        sizes[size],
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}

/* --------------------------------- fields --------------------------------- */

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  optionalLabel?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, error, hint, required, optionalLabel, children, className }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">*</span>
        ) : optionalLabel ? (
          <span className="ml-1.5 text-xs font-normal text-navy-400 dark:text-navy-300">{optionalLabel}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 flex items-start gap-1 text-sm font-medium text-danger">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-navy-500 dark:text-navy-300">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  optionalLabel?: string
  icon?: LucideIcon
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, hint, optionalLabel, icon: Icon, className, id, required, ...rest },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      optionalLabel={optionalLabel}
    >
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400" aria-hidden="true" />
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn('field', Icon && 'pl-11', className)}
          {...rest}
        />
      </div>
    </Field>
  )
})

export const PhoneInput = forwardRef<HTMLInputElement, Omit<TextInputProps, 'inputMode' | 'type'>>(function PhoneInput(
  { label, icon = Phone, onChange, value, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      label={label}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      pattern="[0-9]*"
      maxLength={10}
      placeholder="98765 43210"
      icon={icon}
      value={value}
      onChange={(event) => {
        event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10)
        onChange?.(event)
      }}
      {...rest}
    />
  )
})

export const PlateInput = forwardRef<HTMLInputElement, Omit<TextInputProps, 'onChange'> & { onValueChange: (value: string) => void }>(
  function PlateInput({ label, onValueChange, value, error, hint, icon = CarFront, ...rest }, ref) {
    return (
      <TextInput
        ref={ref}
        label={label}
        value={value}
        error={error}
        hint={hint}
        icon={icon}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={11}
        placeholder="GJ05AB1234"
        className="font-mono text-lg uppercase tracking-[0.08em]"
        onChange={(event) => onValueChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
        {...rest}
      />
    )
  },
)

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  optionalLabel?: string
  children: ReactNode
}

export function SelectInput({ label, error, hint, optionalLabel, className, id, children, ...rest }: SelectProps) {
  const generated = useId()
  const selectId = id ?? generated
  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint} optionalLabel={optionalLabel} required={rest.required}>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        className={cn('field appearance-none bg-[length:18px] pr-10', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%232C4E7A' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
        }}
        {...rest}
      >
        {children}
      </select>
    </Field>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
  optionalLabel?: string
}

export function TextareaInput({ label, error, hint, optionalLabel, className, id, ...rest }: TextareaProps) {
  const generated = useId()
  const areaId = id ?? generated
  return (
    <Field label={label} htmlFor={areaId} error={error} hint={hint} optionalLabel={optionalLabel} required={rest.required}>
      <textarea
        id={areaId}
        aria-invalid={Boolean(error)}
        className={cn('field min-h-[96px] resize-none py-3', className)}
        {...rest}
      />
    </Field>
  )
}

/* ------------------------------- misc pieces ------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { id: T; label: string; icon?: LucideIcon }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-navy-100/80 p-1 dark:bg-white/[0.06]', className)}>
      {options.map((option) => {
        const active = option.id === value
        const Icon = option.icon
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex min-h-[44px] flex-1 snap-start items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors',
              active
                ? 'bg-white text-navy-900 shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-navy-600 hover:text-navy-900 dark:text-navy-200 dark:hover:text-white',
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white">{title}</h2>
      {action}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-navy-200 px-6 py-10 text-center dark:border-white/15', className)}>
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-[#1868FE] dark:bg-blue-500/15 dark:text-blue-300">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-navy-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-navy-500 dark:text-navy-200">{body}</p>
      {action && <div className="mt-5 w-full max-w-[260px]">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  invert,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  invert?: boolean
}) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 py-2">
      <div
        className={cn('min-w-0 flex-1 select-none', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
        onClick={() => !disabled && onChange(!checked)}
      >
        <p className={cn('text-sm font-semibold', invert ? 'text-white' : 'text-navy-900 dark:text-white')}>{label}</p>
        {description && (
          <p className={cn('mt-0.5 text-xs leading-snug', invert ? 'text-navy-300' : 'text-navy-500 dark:text-navy-300')}>
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1868FE] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-[#1868FE]' : invert ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/20',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="surface flex items-center gap-3 p-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-navy-100 dark:border-white/10', className)} />
}

export function KeyValue({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-navy-500 dark:text-navy-200">{label}</span>
      <span className={cn('text-right text-sm font-semibold text-navy-900 dark:text-white', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  )
}
