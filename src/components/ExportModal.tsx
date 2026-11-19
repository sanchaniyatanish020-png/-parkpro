import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { Sheet } from '@/components/Sheet'

export type ExportFormat = 'excel' | 'pdf' | 'csv'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  onExport: (format: ExportFormat) => void
}

export function ExportModal({
  open,
  onClose,
  title = 'Export Report',
  subtitle = 'Choose your preferred file format to download',
  onExport,
}: ExportModalProps) {
  const options = [
    {
      id: 'excel' as const,
      title: 'Excel Workbook (.xlsx)',
      desc: 'Multi-sheet spreadsheet with passes, walk-ins, and financial summary',
      badge: 'XLSX',
      icon: FileSpreadsheet,
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
      iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    },
    {
      id: 'pdf' as const,
      title: 'PDF Document (.pdf)',
      desc: 'Print-ready executive summary with branded header and tabular data',
      badge: 'PDF',
      icon: FileText,
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300',
      iconColor: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    },
    {
      id: 'csv' as const,
      title: 'CSV Spreadsheet (.csv)',
      desc: 'Raw comma-delimited data for import into Google Sheets, databases, or analytics tools',
      badge: 'CSV',
      icon: FileDown,
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
      iconColor: 'bg-blue-50 text-[#1868FE] dark:bg-blue-500/15 dark:text-sky-400',
    },
  ]

  const handleSelect = (format: ExportFormat) => {
    onExport(format)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-3 py-1">
        {options.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              className="flex w-full items-start gap-3.5 rounded-2xl border border-navy-100 bg-white p-4 text-left transition-all hover:border-[#1868FE] hover:shadow-soft active:scale-[0.99] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#1868FE]/50"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${opt.iconColor}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-navy-900 dark:text-white">{opt.title}</p>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${opt.badgeColor}`}>
                    {opt.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-navy-500 dark:text-navy-300">
                  {opt.desc}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

