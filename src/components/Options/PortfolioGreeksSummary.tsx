import { formatCurrency, formatSignedCurrency } from '../../utils/formatters'
import type { OptionPosition, Quote } from '../../types/index'

interface PortfolioGreeksSummaryProps {
  readonly positions: ReadonlyArray<OptionPosition>
  readonly quotes: Readonly<Record<string, Quote>>
}

interface SummaryCard {
  readonly label: string
  readonly value: string
  readonly subtext?: string
  readonly color?: string
}

export function PortfolioGreeksSummary({ positions, quotes }: PortfolioGreeksSummaryProps) {
  const openPositions = positions.filter((p) => p.status === 'OPEN')

  let totalCost = 0
  let totalRealized = 0
  let longCount = 0
  let shortCount = 0

  for (const pos of positions) {
    if (pos.status === 'OPEN') {
      totalCost += pos.avgCostPerContract * pos.openContracts

      if (pos.direction === 'LONG') {
        longCount += pos.openContracts
      } else {
        shortCount += pos.openContracts
      }
    }
    totalRealized += pos.realizedPnl
  }

  const cards: ReadonlyArray<SummaryCard> = [
    {
      label: 'Open Positions',
      value: openPositions.length.toString(),
      subtext: `${longCount} long / ${shortCount} short`
    },
    {
      label: 'Total Cost',
      value: formatCurrency(totalCost)
    },
    {
      label: 'Unrealized P&L',
      value: 'N/A',
      subtext: 'Requires option quotes',
      color: 'text-sv-text-muted'
    },
    {
      label: 'Realized P&L',
      value: formatSignedCurrency(totalRealized),
      color: totalRealized >= 0 ? 'text-sv-positive' : 'text-sv-negative'
    },
    {
      label: 'Total Realized',
      value: formatSignedCurrency(totalRealized),
      subtext: 'Closed positions only',
      color: totalRealized >= 0 ? 'text-sv-positive' : 'text-sv-negative'
    }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-sv-surface rounded-lg border border-sv-border px-4 py-3"
        >
          <p className="text-xs text-sv-text-muted mb-1">{card.label}</p>
          <p className={`text-lg font-semibold font-mono tabular-nums ${card.color ?? 'text-sv-text'}`}>
            {card.value}
          </p>
          {card.subtext && (
            <p className="text-xs text-sv-text-muted mt-0.5">{card.subtext}</p>
          )}
        </div>
      ))}
    </div>
  )
}
