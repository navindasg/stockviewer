import { formatCurrency, formatPercent } from '../../utils/formatters'
import type { PortfolioDividendSummary } from '../../types/index'

interface StatCardProps {
  readonly label: string
  readonly value: string
  readonly subValue?: string
}

function StatCard({ label, value, subValue }: StatCardProps) {
  return (
    <div className="rounded-lg bg-sv-surface border border-sv-border p-4">
      <p className="text-xs text-sv-text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-xl font-mono tabular-nums font-semibold text-sv-positive">
        {value}
      </p>
      {subValue && (
        <p className="text-sm font-mono tabular-nums mt-0.5 text-sv-text-secondary">
          {subValue}
        </p>
      )}
    </div>
  )
}

interface DividendSummaryCardsProps {
  readonly summary: PortfolioDividendSummary | null
  readonly isLoading: boolean
}

export function DividendSummaryCards({ summary, isLoading }: DividendSummaryCardsProps) {
  if (isLoading || !summary) {
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
        label="All-Time Income"
        value={formatCurrency(summary.totalIncomeAllTime)}
        subValue={`${summary.perTicker.reduce((s, t) => s + t.paymentCount, 0)} payments`}
      />
      <StatCard
        label="YTD Income"
        value={formatCurrency(summary.totalIncomeYtd)}
      />
      <StatCard
        label="Trailing 12M Income"
        value={formatCurrency(summary.totalIncomeTrailing12m)}
      />
      <StatCard
        label="Annualized Income"
        value={formatCurrency(summary.totalAnnualizedIncome)}
        subValue={summary.averageYield > 0 ? `${formatPercent(summary.averageYield)} avg yield` : undefined}
      />
    </div>
  )
}
