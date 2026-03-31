import { useMemo } from 'react'
import { usePortfolioStats } from '../../hooks/usePortfolioStats'
import { computePortfolioSummary } from '../../utils/calculations'
import type { Position, Quote } from '../../types/index'
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent
} from '../../utils/formatters'

interface StatCardProps {
  readonly label: string
  readonly value: string
  readonly subValue?: string
  readonly colorClass: string
}

function StatCard({ label, value, subValue, colorClass }: StatCardProps) {
  return (
    <div className="rounded-lg bg-sv-surface border border-sv-border p-4">
      <p className="text-xs text-sv-text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-xl font-mono tabular-nums font-semibold ${colorClass}`}>
        {value}
      </p>
      {subValue && (
        <p className={`text-sm font-mono tabular-nums mt-0.5 ${colorClass}`}>
          {subValue}
        </p>
      )}
    </div>
  )
}

function getGainColorClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

interface PortfolioSummaryProps {
  readonly filteredPositions?: ReadonlyArray<Position>
  readonly quotes?: Readonly<Record<string, Quote>>
}

export function PortfolioSummary({ filteredPositions, quotes }: PortfolioSummaryProps = {}) {
  const { summary: allSummary, isLoading } = usePortfolioStats()

  const summary = useMemo(() => {
    if (!filteredPositions || !quotes) return allSummary
    const quotesArray = Object.values(quotes)
    return computePortfolioSummary(filteredPositions, quotesArray)
  }, [filteredPositions, quotes, allSummary])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg bg-sv-surface border border-sv-border p-4 animate-pulse h-20"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Portfolio Value"
        value={formatCurrency(summary.totalValue)}
        colorClass="text-sv-text"
      />
      <StatCard
        label="Day Change"
        value={formatSignedCurrency(summary.totalDayChange)}
        subValue={formatPercent(summary.totalDayChangePercent)}
        colorClass={getGainColorClass(summary.totalDayChange)}
      />
      <StatCard
        label="Unrealized Gain/Loss"
        value={formatSignedCurrency(summary.totalUnrealizedGain)}
        subValue={formatPercent(summary.totalUnrealizedGainPercent)}
        colorClass={getGainColorClass(summary.totalUnrealizedGain)}
      />
      <StatCard
        label="Realized Gain/Loss"
        value={formatSignedCurrency(summary.totalRealizedGain)}
        colorClass={getGainColorClass(summary.totalRealizedGain)}
      />
    </div>
  )
}
