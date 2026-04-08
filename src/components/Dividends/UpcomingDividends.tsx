import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { formatCurrency, formatDate } from '../../utils/formatters'
import type { DividendInfo, Position } from '../../types/index'

interface UpcomingEntry {
  readonly ticker: string
  readonly companyName: string
  readonly exDate: string
  readonly dividendRate: number
  readonly yield: number
}

export function UpcomingDividends() {
  const positions = useAppStore((s) => s.positions)
  const [entries, setEntries] = useState<ReadonlyArray<UpcomingEntry>>([])
  const [isLoading, setIsLoading] = useState(false)

  const openPositions = useMemo(
    () => positions.filter((p): p is Position => p.status === 'OPEN'),
    [positions]
  )

  const openTickerKey = useMemo(
    () => openPositions.map((p) => p.ticker).sort().join(','),
    [openPositions]
  )

  useEffect(() => {
    if (openPositions.length === 0) return

    let cancelled = false
    setIsLoading(true)

    const fetchAll = async () => {
      const results: UpcomingEntry[] = []

      for (const pos of openPositions) {
        try {
          const info = await window.electronAPI.getDividendInfo(pos.ticker) as DividendInfo
          if (info.exDividendDate && info.dividendRate) {
            const exDate = info.exDividendDate
            if (exDate >= new Date().toISOString().split('T')[0]) {
              results.push({
                ticker: pos.ticker,
                companyName: pos.companyName,
                exDate,
                dividendRate: info.trailingAnnualDividendRate ?? info.dividendRate,
                yield: info.trailingAnnualDividendYield ?? info.dividendYield ?? 0
              })
            }
          }
        } catch {
          // Skip tickers that fail — not all positions pay dividends
        }
      }

      if (!cancelled) {
        const sorted = [...results].sort((a, b) => a.exDate.localeCompare(b.exDate))
        setEntries(sorted)
        setIsLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [openTickerKey, openPositions])

  if (isLoading) {
    return (
      <div className="bg-sv-surface rounded-lg border border-sv-border p-4">
        <h3 className="text-sm font-semibold text-sv-text mb-3">Upcoming Ex-Dates</h3>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-sv-elevated rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border p-4">
      <h3 className="text-sm font-semibold text-sv-text mb-3">Upcoming Ex-Dates</h3>
      {entries.length === 0 ? (
        <p className="text-sv-text-muted text-xs">No upcoming ex-dividend dates found for your holdings.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.ticker}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-sv-elevated/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-sv-text">{entry.ticker}</span>
                <span className="text-xs text-sv-text-muted truncate max-w-[120px]">{entry.companyName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-sv-text-secondary">{formatDate(entry.exDate)}</span>
                <span className="text-xs font-mono tabular-nums text-sv-positive">
                  {formatCurrency(entry.dividendRate)}/yr
                </span>
                <span className="text-xs font-mono tabular-nums text-sv-accent">
                  {entry.yield.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
