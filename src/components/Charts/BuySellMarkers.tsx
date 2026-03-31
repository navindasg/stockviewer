import type { Transaction } from '../../types/index'

interface AggregatedMarker {
  readonly date: string
  readonly price: number
  readonly type: 'BUY' | 'SELL' | 'MIXED'
  readonly transactions: ReadonlyArray<{
    readonly type: 'BUY' | 'SELL'
    readonly shares: number
    readonly price: number
  }>
}

interface BuySellMarkersProps {
  readonly xScale: (value: string) => number
  readonly yScale: (value: number) => number
  readonly markers: ReadonlyArray<AggregatedMarker>
}

function getMarkerColor(type: 'BUY' | 'SELL' | 'MIXED'): string {
  if (type === 'BUY') return '#22C55E'
  if (type === 'SELL') return '#EF4444'
  return '#F59E0B'
}

export function BuySellMarkers({ xScale, yScale, markers }: BuySellMarkersProps) {
  return (
    <g className="buy-sell-markers">
      {markers.map((marker) => {
        const cx = xScale(marker.date)
        const cy = yScale(marker.price)

        if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) {
          return null
        }

        const color = getMarkerColor(marker.type)

        return (
          <circle
            key={`${marker.date}-${marker.type}`}
            cx={cx}
            cy={cy}
            r={5}
            fill={color}
            stroke="#0A0E17"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
          />
        )
      })}
    </g>
  )
}

export function aggregateTransactionsByDate(
  transactions: ReadonlyArray<Transaction>
): ReadonlyArray<AggregatedMarker> {
  const grouped = new Map<string, ReadonlyArray<Transaction>>()

  for (const tx of transactions) {
    const dateKey = tx.date.slice(0, 10)
    const existing = grouped.get(dateKey) ?? []
    grouped.set(dateKey, [...existing, tx])
  }

  const result: Array<AggregatedMarker> = []

  for (const [dateKey, txs] of grouped) {
    const hasBuy = txs.some((tx) => tx.type === 'BUY')
    const hasSell = txs.some((tx) => tx.type === 'SELL')

    const type: 'BUY' | 'SELL' | 'MIXED' =
      hasBuy && hasSell ? 'MIXED' : hasBuy ? 'BUY' : 'SELL'

    const totalShares = txs.reduce((sum, tx) => sum + tx.shares, 0)
    const weightedPrice =
      txs.reduce((sum, tx) => sum + tx.price * tx.shares, 0) / totalShares

    result.push({
      date: dateKey,
      price: weightedPrice,
      type,
      transactions: txs.map((tx) => ({
        type: tx.type,
        shares: tx.shares,
        price: tx.price
      }))
    })
  }

  return result
}

export type { AggregatedMarker }
