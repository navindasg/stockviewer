import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { formatCurrency, formatSignedCurrency } from '../../utils/formatters'

function getGainClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function TaxReportPanel() {
  const fetchTaxReport = useAppStore((s) => s.fetchTaxReport)
  const exportTaxReportCsv = useAppStore((s) => s.exportTaxReportCsv)
  const taxReport = useAppStore((s) => s.taxReport)

  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y)
    }
    return years
  }, [currentYear])

  useEffect(() => {
    fetchTaxReport(selectedYear).catch(() => {})
  }, [selectedYear, fetchTaxReport])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportResult(null)
    try {
      const filePath = await exportTaxReportCsv(selectedYear)
      if (filePath) {
        setExportResult(filePath)
      }
    } catch {
      setExportResult(null)
    } finally {
      setIsExporting(false)
    }
  }, [selectedYear, exportTaxReportCsv])

  const handleYearChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedYear(val === 'all' ? undefined : parseInt(val, 10))
    setExportResult(null)
  }, [])

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-sv-text">Tax Report Summary</h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear ?? 'all'}
            onChange={handleYearChange}
            className="bg-sv-elevated border border-sv-border rounded px-2 py-1 text-xs text-sv-text focus:outline-none focus:ring-1 focus:ring-sv-accent cursor-pointer"
          >
            <option value="all">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || !taxReport || taxReport.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-sv-text bg-sv-elevated border border-sv-border rounded hover:bg-sv-bg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {taxReport && taxReport.rows.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="Short-Term Gains"
            value={taxReport.totalShortTermGain}
            sublabel="Held < 1 year"
          />
          <SummaryCard
            label="Long-Term Gains"
            value={taxReport.totalLongTermGain}
            sublabel="Held >= 1 year"
          />
          <SummaryCard
            label="Wash Sale Adj."
            value={taxReport.totalWashSaleAdjustment}
            sublabel="Disallowed losses"
            isAdjustment
          />
          <SummaryCard
            label="Total Proceeds"
            value={taxReport.totalProceeds}
            neutral
          />
          <SummaryCard
            label="Total Cost Basis"
            value={taxReport.totalCostBasis}
            neutral
          />
          <SummaryCard
            label="Net Gain/Loss"
            value={taxReport.totalGainOrLoss}
          />
        </div>
      ) : (
        <p className="text-xs text-sv-text-muted">
          {taxReport ? 'No realized gains or losses for the selected period.' : 'Loading...'}
        </p>
      )}

      {taxReport && taxReport.rows.length > 0 && (
        <div className="mt-3 text-[10px] text-sv-text-muted">
          {taxReport.rows.length} lot disposition{taxReport.rows.length !== 1 ? 's' : ''} &middot; Form 8949 format
        </div>
      )}

      {exportResult && (
        <div className="mt-2 px-2 py-1.5 rounded bg-sv-positive/10 border border-sv-positive/20">
          <p className="text-[10px] text-sv-positive">Exported to: {exportResult}</p>
        </div>
      )}
    </div>
  )
}

interface SummaryCardProps {
  readonly label: string
  readonly value: number
  readonly sublabel?: string
  readonly neutral?: boolean
  readonly isAdjustment?: boolean
}

function SummaryCard({ label, value, sublabel, neutral, isAdjustment }: SummaryCardProps) {
  const colorClass = neutral
    ? 'text-sv-text'
    : isAdjustment
      ? value > 0 ? 'text-amber-400' : 'text-sv-text-muted'
      : getGainClass(value)

  return (
    <div className="bg-sv-bg rounded-md border border-sv-border/50 px-3 py-2">
      <p className="text-[10px] text-sv-text-muted uppercase tracking-wider">{label}</p>
      <p className={`font-mono tabular-nums text-sm font-semibold mt-0.5 ${colorClass}`}>
        {neutral ? formatCurrency(value) : formatSignedCurrency(value)}
      </p>
      {sublabel && (
        <p className="text-[9px] text-sv-text-muted mt-0.5">{sublabel}</p>
      )}
    </div>
  )
}
