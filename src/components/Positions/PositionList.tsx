import { useState, useMemo, useCallback } from 'react'
import type { Position, Quote } from '../../types/index'
import { useAppStore } from '../../stores/appStore'
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatShares
} from '../../utils/formatters'

interface PositionListProps {
  readonly positions: ReadonlyArray<Position>
  readonly quotes: Readonly<Record<string, Quote>>
}

type SortField =
  | 'ticker'
  | 'companyName'
  | 'shares'
  | 'avgCost'
  | 'price'
  | 'marketValue'
  | 'gainLoss'
  | 'gainLossPercent'
  | 'dayChange'

type SortDirection = 'asc' | 'desc'

interface SortState {
  readonly field: SortField
  readonly direction: SortDirection
}

interface EnrichedPosition {
  readonly position: Position
  readonly quote: Quote | undefined
  readonly marketValue: number
  readonly gainLoss: number
  readonly gainLossPercent: number
  readonly dayChange: number
}

function enrichPosition(
  position: Position,
  quotes: Readonly<Record<string, Quote>>
): EnrichedPosition {
  const quote = quotes[position.ticker]
  const price = quote?.price ?? 0
  const marketValue = price * position.totalShares
  const costTotal = position.costBasis * position.totalShares
  const gainLoss = marketValue - costTotal
  const gainLossPercent = costTotal > 0 ? (gainLoss / costTotal) * 100 : 0
  const dayChange = quote ? quote.dayChange * position.totalShares : 0

  return { position, quote, marketValue, gainLoss, gainLossPercent, dayChange }
}

function compareValues(a: number | string, b: number | string, dir: SortDirection): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  }
  const numA = typeof a === 'number' ? a : 0
  const numB = typeof b === 'number' ? b : 0
  return dir === 'asc' ? numA - numB : numB - numA
}

function getSortValue(item: EnrichedPosition, field: SortField): number | string {
  switch (field) {
    case 'ticker': return item.position.ticker
    case 'companyName': return item.position.companyName
    case 'shares': return item.position.totalShares
    case 'avgCost': return item.position.costBasis
    case 'price': return item.quote?.price ?? 0
    case 'marketValue': return item.marketValue
    case 'gainLoss': return item.gainLoss
    case 'gainLossPercent': return item.gainLossPercent
    case 'dayChange': return item.dayChange
  }
}

function getGainClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

const COLUMNS: ReadonlyArray<{ readonly field: SortField; readonly label: string; readonly align: string }> = [
  { field: 'ticker', label: 'Ticker', align: 'text-left' },
  { field: 'companyName', label: 'Company', align: 'text-left' },
  { field: 'shares', label: 'Shares', align: 'text-right' },
  { field: 'avgCost', label: 'Avg Cost', align: 'text-right' },
  { field: 'price', label: 'Price', align: 'text-right' },
  { field: 'marketValue', label: 'Mkt Value', align: 'text-right' },
  { field: 'gainLoss', label: 'Gain/Loss', align: 'text-right' },
  { field: 'gainLossPercent', label: 'Gain %', align: 'text-right' },
  { field: 'dayChange', label: 'Day Chg', align: 'text-right' }
] as const

function SortArrow({ active, direction }: { readonly active: boolean; readonly direction: SortDirection }) {
  if (!active) return <span className="text-sv-text-muted ml-1 opacity-0 group-hover:opacity-50">&#9650;</span>
  return <span className="text-sv-accent ml-1">{direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
}

export function PositionList({ positions, quotes }: PositionListProps) {
  const setSelectedTicker = useAppStore((s) => s.setSelectedTicker)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const [sort, setSort] = useState<SortState>({ field: 'marketValue', direction: 'desc' })

  const enriched = useMemo(
    () => positions
      .filter((p) => p.status === 'OPEN')
      .map((p) => enrichPosition(p, quotes)),
    [positions, quotes]
  )

  const sorted = useMemo(() => {
    const items = [...enriched]
    items.sort((a, b) => compareValues(getSortValue(a, sort.field), getSortValue(b, sort.field), sort.direction))
    return items
  }, [enriched, sort])

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  const handleRowClick = useCallback((ticker: string) => {
    setSelectedTicker(ticker)
    setActiveView('position-detail')
  }, [setSelectedTicker, setActiveView])

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg bg-sv-surface border border-sv-border p-8 text-center text-sv-text-muted text-sm">
        No open positions to display
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-sv-surface border border-sv-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sv-border">
            {COLUMNS.map((col) => (
              <th
                key={col.field}
                className={`px-3 py-2.5 font-medium text-sv-text-muted text-xs uppercase tracking-wider cursor-pointer select-none group ${col.align}`}
                onClick={() => handleSort(col.field)}
              >
                {col.label}
                <SortArrow active={sort.field === col.field} direction={sort.direction} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => (
            <tr
              key={item.position.ticker}
              className={`border-b border-sv-border/50 cursor-pointer transition-colors hover:bg-sv-elevated ${idx % 2 === 0 ? 'bg-sv-surface' : 'bg-sv-bg'}`}
              onClick={() => handleRowClick(item.position.ticker)}
            >
              <td className="px-3 py-2.5 font-semibold text-sv-accent">{item.position.ticker}</td>
              <td className="px-3 py-2.5 text-sv-text-secondary truncate max-w-[160px]">{item.position.companyName}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-sv-text">{formatShares(item.position.totalShares)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-sv-text">{formatCurrency(item.position.costBasis)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-sv-text">{item.quote ? formatCurrency(item.quote.price) : '--'}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-sv-text">{formatCurrency(item.marketValue)}</td>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${getGainClass(item.gainLoss)}`}>{formatSignedCurrency(item.gainLoss)}</td>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${getGainClass(item.gainLossPercent)}`}>{formatPercent(item.gainLossPercent)}</td>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${getGainClass(item.dayChange)}`}>{formatSignedCurrency(item.dayChange)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
