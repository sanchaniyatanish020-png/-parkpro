import type { Pass, TodayPaymentItem, WalkIn, Lang } from '@/types'
import { formatDateShort, formatPlate } from '@/lib/utils'

export interface ReportExportData {
  siteName: string
  rangeLabel: string
  reportType?: 'passes' | 'payments'
  passes: Pass[]
  walkins: WalkIn[]
  payments?: TodayPaymentItem[]
  cashTotal?: number
  onlineTotal?: number
  totalRevenue: number
  totalEntries: number
  lang?: Lang
}

// xlsx and jsPDF are ~700 kB combined; they load only when a file is actually
// generated so they never sit on the critical path of the Passes/Reports pages.
const loadSpreadsheet = () => import('xlsx')
const loadPdf = async () => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF, autoTable }
}

export function exportCsvReport(data: ReportExportData, filename: string) {
  let headers: string[]
  let rows: (string | number)[][]

  if (data.reportType === 'payments' && data.payments) {
    headers = ['Customer', 'Phone', 'Vehicle', 'Type', 'Payment Mode', 'Amount (INR)', 'Collected By', 'Date & Time']
    rows = data.payments.map((item) => [
      `"${item.customerName.replace(/"/g, '""')}"`,
      `"${item.phone}"`,
      `"${item.vehicle ? formatPlate(item.vehicle) : '—'}"`,
      `"${item.kind}"`,
      `"${item.paymentMode.toUpperCase()}"`,
      item.amount,
      `"${(item.collectedBy ? (item.collectedByUsername ? `${item.collectedBy} (@${item.collectedByUsername})` : item.collectedBy) : 'Staff / Admin').replace(/"/g, '""')}"`,
      `"${new Date(item.at).toLocaleString('en-IN')}"`,
    ])
  } else {
    headers = ['Name', 'Phone', 'Vehicle', 'Plan', 'Start Date', 'End Date', 'Amount (INR)', 'Payment Mode', 'Collected By', 'Token']
    rows = data.passes.map((pass) => [
      `"${pass.name.replace(/"/g, '""')}"`,
      `"${pass.phone}"`,
      `"${formatPlate(pass.vehicle)}"`,
      `"${pass.plan}"`,
      `"${formatDateShort(pass.startDate, 'en')}"`,
      `"${formatDateShort(pass.endDate, 'en')}"`,
      pass.amount,
      `"${(pass.paymentMode ?? 'cash').toUpperCase()}"`,
      `"${(pass.collectedBy ?? 'Admin').replace(/"/g, '""')}"`,
      `"${pass.token}"`,
    ])
  }

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportExcelReport(data: ReportExportData, filename: string) {
  const XLSX = await loadSpreadsheet()
  const wb = XLSX.utils.book_new()

  if (data.reportType === 'payments' && data.payments) {
    const payRows = data.payments.map((item) => ({
      Customer: item.customerName,
      Phone: item.phone,
      Vehicle: item.vehicle ? formatPlate(item.vehicle) : '—',
      Type: item.kind.toUpperCase(),
      'Payment Mode': item.paymentMode.toUpperCase(),
      'Amount (₹)': item.amount,
      'Collected By': item.collectedBy
        ? item.collectedByUsername
          ? `${item.collectedBy} (@${item.collectedByUsername})`
          : item.collectedBy
        : 'Staff / Admin',
      'Date & Time': new Date(item.at).toLocaleString('en-IN'),
    }))
    const paySheet = XLSX.utils.json_to_sheet(payRows.length > 0 ? payRows : [{ 'No Data': 'No payments in selected filter' }])
    XLSX.utils.book_append_sheet(wb, paySheet, 'Payments')
  }

  // Sheet: Passes
  const passRows = data.passes.map((pass) => ({
    'Pass ID': pass.id,
    Token: pass.token,
    Name: pass.name,
    Phone: pass.phone,
    Vehicle: formatPlate(pass.vehicle),
    'Vehicle Type': pass.vehicleType.toUpperCase(),
    Plan: pass.plan.toUpperCase(),
    'Start Date': formatDateShort(pass.startDate, 'en'),
    'End Date': formatDateShort(pass.endDate, 'en'),
    'Payment Mode': (pass.paymentMode ?? 'cash').toUpperCase(),
    'Collected By': pass.collectedBy ?? 'Admin',
    'Amount (₹)': pass.amount,
  }))
  const passSheet = XLSX.utils.json_to_sheet(passRows.length > 0 ? passRows : [{ 'No Data': 'No passes in selected period' }])
  XLSX.utils.book_append_sheet(wb, passSheet, 'Passes')

  // Sheet: Walk-ins
  const walkinRows = data.walkins.map((w) => ({
    'Entry ID': w.id,
    Name: w.name,
    Phone: w.phone,
    Vehicle: w.vehicle ? formatPlate(w.vehicle) : '—',
    'Vehicle Type': w.vehicleType.toUpperCase(),
    'Payment Mode': (w.paymentMode ?? 'cash').toUpperCase(),
    'Collected By': w.collectedBy ?? 'Staff',
    'Amount (₹)': w.amount,
    'Date & Time': new Date(w.at).toLocaleString('en-IN'),
  }))
  const walkinSheet = XLSX.utils.json_to_sheet(walkinRows.length > 0 ? walkinRows : [{ 'No Data': 'No walk-in entries in selected period' }])
  XLSX.utils.book_append_sheet(wb, walkinSheet, 'Walk-ins')

  // Sheet: Summary
  const summaryRows = [
    { Parameter: 'Site Name', Value: data.siteName },
    { Parameter: 'Report Type', Value: data.reportType === 'payments' ? 'Payment Reports' : 'Pass Reports' },
    { Parameter: 'Report Period', Value: data.rangeLabel },
    { Parameter: 'Export Date', Value: new Date().toLocaleString('en-IN') },
    { Parameter: 'Total Passes Sold', Value: data.passes.length },
    { Parameter: 'Total Walk-in Entries', Value: data.walkins.length },
    { Parameter: 'Total Recorded Entries', Value: data.totalEntries },
    { Parameter: 'Cash Collected (₹)', Value: data.cashTotal ?? 0 },
    { Parameter: 'Online (UPI/Card) Collected (₹)', Value: data.onlineTotal ?? 0 },
    { Parameter: 'Total Revenue (₹)', Value: data.totalRevenue },
  ]
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  const targetName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, targetName)
}

export async function exportPdfReport(data: ReportExportData, filename: string) {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const primaryColor = [11, 31, 58] // #0B1F3A
  const accentColor = [255, 180, 0] // #FFB400

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 75, 'F')
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
  doc.rect(0, 75, doc.internal.pageSize.getWidth(), 3, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ParkPro — Parking Report', 40, 36)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(217, 228, 242)
  doc.text(`${data.siteName} · ${data.rangeLabel}`, 40, 54)

  const dateStr = `Exported: ${new Date().toLocaleDateString('en-IN')}`
  doc.text(dateStr, doc.internal.pageSize.getWidth() - 40 - doc.getTextWidth(dateStr), 54)

  // Summary Metrics Bar
  let y = 95
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(40, y, doc.internal.pageSize.getWidth() - 80, 50, 6, 6, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  if (data.reportType === 'payments') {
    doc.text('TOTAL COLLECTED', 56, y + 20)
    doc.text('CASH', 210, y + 20)
    doc.text('ONLINE (UPI)', 350, y + 20)
    doc.setFontSize(14)
    doc.setTextColor(11, 31, 58)
    doc.text(`${data.totalRevenue.toLocaleString('en-IN')}`, 56, y + 38)
    doc.text(`${(data.cashTotal ?? 0).toLocaleString('en-IN')}`, 210, y + 38)
    doc.text(`${(data.onlineTotal ?? 0).toLocaleString('en-IN')}`, 350, y + 38)
  } else {
    doc.text('TOTAL REVENUE', 56, y + 20)
    doc.text('PASSES SOLD', 210, y + 20)
    doc.text('WALK-IN ENTRIES', 350, y + 20)
    doc.setFontSize(14)
    doc.setTextColor(11, 31, 58)
    doc.text(`${data.totalRevenue.toLocaleString('en-IN')}`, 56, y + 38)
    doc.text(String(data.passes.length), 210, y + 38)
    doc.text(String(data.walkins.length), 350, y + 38)
  }

  y += 70

  if (data.reportType === 'payments' && data.payments) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(11, 31, 58)
    doc.text('Payments List', 40, y)

    const payTableData = data.payments.map((item) => [
      item.customerName,
      item.vehicle ? formatPlate(item.vehicle) : item.phone,
      item.kind.toUpperCase(),
      item.paymentMode.toUpperCase(),
      item.collectedBy ?? 'Staff / Admin',
      `${item.amount.toLocaleString('en-IN')}`,
    ])

    autoTable(doc, {
      startY: y + 8,
      margin: { left: 40, right: 40 },
      head: [['Customer', 'Vehicle / Phone', 'Type', 'Mode', 'Collected By', 'Amount']],
      body: payTableData.length > 0 ? payTableData : [['No payments in selected filter', '', '', '', '', '']],
      theme: 'grid',
      headStyles: {
        fillColor: [11, 31, 58],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        5: { halign: 'right' },
      },
    })
  } else {
    // Passes Table
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(11, 31, 58)
    doc.text('Passes List', 40, y)

    const passTableData = data.passes.map((pass) => [
      pass.name,
      pass.phone,
      formatPlate(pass.vehicle),
      pass.plan.toUpperCase(),
      `${formatDateShort(pass.startDate, 'en')} – ${formatDateShort(pass.endDate, 'en')}`,
      `${pass.amount.toLocaleString('en-IN')}`,
    ])

    autoTable(doc, {
      startY: y + 8,
      margin: { left: 40, right: 40 },
      head: [['Name', 'Phone', 'Vehicle', 'Plan', 'Validity', 'Amount']],
      body: passTableData.length > 0 ? passTableData : [['No passes in selected period', '', '', '', '', '']],
      theme: 'grid',
      headStyles: {
        fillColor: [11, 31, 58],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        5: { halign: 'right' },
      },
    })
  }

  // Footer on each page
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    const footerText = `Page ${i} of ${pageCount} · Generated by ParkPro Smart Parking Management`
    doc.text(footerText, 40, doc.internal.pageSize.getHeight() - 20)
  }

  const targetName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  doc.save(targetName)
}

export async function exportPassesList(
  passes: Pass[],
  siteName: string,
  format: 'excel' | 'pdf' | 'csv',
  filename = 'parkpro-passes'
) {
  if (format === 'excel') {
    const XLSX = await loadSpreadsheet()
    const wb = XLSX.utils.book_new()
    const rows = passes.map((p) => ({
      Token: p.token,
      Name: p.name,
      Phone: p.phone,
      Vehicle: formatPlate(p.vehicle),
      'Vehicle Type': p.vehicleType.toUpperCase(),
      Plan: p.plan.toUpperCase(),
      'Start Date': formatDateShort(p.startDate, 'en'),
      'End Date': formatDateShort(p.endDate, 'en'),
      'Amount (₹)': p.amount,
      Created: new Date(p.createdAt).toLocaleDateString('en-IN'),
    }))
    const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'No Passes': 'No passes found' }])
    XLSX.utils.book_append_sheet(wb, sheet, 'Passes')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } else if (format === 'pdf') {
    const { jsPDF, autoTable } = await loadPdf()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    doc.setFillColor(11, 31, 58)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 65, 'F')
    doc.setFillColor(255, 180, 0)
    doc.rect(0, 65, doc.internal.pageSize.getWidth(), 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('ParkPro — Passes Directory', 40, 34)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(217, 228, 242)
    doc.text(`${siteName} · Total: ${passes.length} passes`, 40, 50)

    const tableData = passes.map((p) => [
      p.token,
      p.name,
      p.phone,
      formatPlate(p.vehicle),
      p.plan.toUpperCase(),
      `${formatDateShort(p.startDate, 'en')} – ${formatDateShort(p.endDate, 'en')}`,
      `${p.amount.toLocaleString('en-IN')}`,
    ])

    autoTable(doc, {
      startY: 85,
      margin: { left: 40, right: 40 },
      head: [['Token', 'Name', 'Phone', 'Vehicle', 'Plan', 'Validity', 'Amount']],
      body: tableData.length > 0 ? tableData : [['No passes available', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: {
        fillColor: [11, 31, 58],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 4.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 6: { halign: 'right' } },
    })

    const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Page ${i} of ${pageCount} · ${siteName}`, 40, doc.internal.pageSize.getHeight() - 20)
    }
    doc.save(`${filename}.pdf`)
  } else {
    const headers = ['Token', 'Name', 'Phone', 'Vehicle', 'Plan', 'Start Date', 'End Date', 'Amount (INR)']
    const rows = passes.map((p) => [
      `"${p.token}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.phone}"`,
      `"${formatPlate(p.vehicle)}"`,
      `"${p.plan}"`,
      `"${formatDateShort(p.startDate, 'en')}"`,
      `"${formatDateShort(p.endDate, 'en')}"`,
      p.amount,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
}
