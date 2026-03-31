import type { Transaction } from '../../types/index'
import { formatCurrency, formatDate, formatShares } from '../../utils/formatters'

interface TransactionOnDay {
  readonly type: 'BUY' | 'SELL'
  readonly shares: number
  readonly price: number
}

interface ChartTooltipProps {
  readonly active?: boolean
  readonly payload?: ReadonlyArray<{
    readonly value: number
    readonly payload: {
      readonly date: string
      readonly close: number
      readonly transactions?: ReadonlyArray<TransactionOnDay>
    }
  }>
  readonly label?: string
}

export function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const data = payload[0].payload
  const transactions = data.transactions ?? []

  return (
    <div
      className="rounded border border-sv-border bg-sv-elevated px-3 py-2 shadow-lg"
      style={{ minWidth: 160 }}
    >
      <p className="mb-1 text-xs text-sv-text-secondary">
        {formatDate(data.date)}
      </p>
      <p className="text-sm font-medium text-sv-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(data.close)}
      </p>
      {transactions.length > 0 && (
        <div className="mt-2 border-t border-sv-border pt-2">
          {transactions.map((tx, idx) => (
            <p
              key={idx}
              className="text-xs font-medium"
              style={{
                color: tx.type === 'BUY' ? '#22C55E' : '#EF4444',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {tx.type} {formatShares(tx.shares)} shares @ {formatCurrency(tx.price)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export type { TransactionOnDay }
