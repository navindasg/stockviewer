import { useState, useMemo, useCallback } from 'react'
import { addMonths, differenceInCalendarDays, differenceInMonths, differenceInYears, parseISO } from 'date-fns'
import { useAppStore } from '../../stores/appStore'
import type { Position } from '../../types/index'
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatDate
} from '../../utils/formatters'

type SortField =
  | 'ticker'
  | 'companyName'
  | 'closeDate'
  | 'holdingPeriodDays'
  | 'totalInvested'
  | 'totalRealized'
  | 'returnPct'

type SortDirection = 'asc' | 'desc'

interface SortState {
  readonly field: SortField
  readonly direction: SortDirection
}

interface EnrichedClosed {
  readonly position: Position
  readonly returnPct: number
  readonly holdingPeriodDays: number
  readonly holdingPeriodLabel: string
  readonly isShortTerm: boolean
}

function getGainClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

function computeHoldingPeriod(firstBuyDate: string | null, lastSellDate: string | null): {
  readonly days: number
  readonly label: string
  readonly isShortTerm: boolean
} {
  if (!firstBuyDate || !lastSellDate) {
    return { days: 0, label: '--', isShortTerm: false }
  }

  const start = parseISO(firstBuyDate)
  const end = parseISO(lastSellDate)
  const totalDays = differenceInCalendarDays(end, start)

  if (totalDays < 0) {
    return { days: 0, label: '--', isShortTerm: false }
  }

  const years = differenceInYears(end, start)
  const monthsAfterYears = differenceInMonths(end, start) - years * 12
  const isShortTerm = totalDays < 365

  if (years >= 1) {
    const parts: string[] = [`${years}y`]
    if (monthsAfterYears > 0) {
      parts.push(`${monthsAfterYears}mo`)
    }
    return { days: totalDays, label: parts.join(' '), isShortTerm }
  }

  if (totalDays >= 30) {
    const months = differenceInMonths(end, start)
    const afterMonths = addMonths(start, months)
    const remainingDays = differenceInCalendarDays(end, afterMonths)
    const parts: string[] = [`${months}mo`]
    if (remainingDays > 0) {
      parts.push(`${remainingDays}d`)
    }
    return { days: totalDays, label: parts.join(' '), isShortTerm }
  }

  return { days: totalDays, label: `${totalDays}d`, isShortTerm }
}

function enrichClosedPosition(position: Position): EnrichedClosed {
  const returnPct = position.totalInvested > 0
    ? (position.totalRealized / position.totalInvested) * 100
    : 0
  const { days, label, isShortTerm } = computeHoldingPeriod(
    position.firstBuyDate,
    position.lastSellDate
  )
  return { position, returnPct, holdingPeriodDays: days, holdingPeriodLabel: label, isShortTerm }
}

function getSortValue(item: EnrichedClosed, field: SortField): number | string {
  switch (field) {
    case 'ticker': return item.position.ticker
    case 'companyName': return item.position.companyName
    case 'closeDate': return item.position.lastSellDate ?? ''
    case 'holdingPeriodDays': return item.holdingPeriodDays
    case 'totalInvested': return item.position.totalInvested
    case 'totalRealized': return item.position.totalRealized
    case 'returnPct': return item.returnPct
  }
}

function compareValues(a: number | string, b: number | string, dir: SortDirection): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  }
  const numA = typeof a === 'number' ? a : 0
  const numB = typeof b === 'number' ? b : 0
  return dir === 'asc' ? numA - numB : numB - numA
}

const COLUMNS: ReadonlyArray<{
  readonly field: SortField
  readonly label: string
  readonly align: string
}> = [
  { field: 'ticker', label: 'Ticker', align: 'text-left' },
  { field: 'companyName', label: 'Company', align: 'text-left' },
  { field: 'closeDate', label: 'Close Date', align: 'text-right' },
  { field: 'holdingPeriodDays', label: 'Holding Period', align: 'text-right' },
  { field: 'totalInvested', label: 'Total Invested', align: 'text-right' },
  { field: 'totalRealized', label: 'Realized P&L', align: 'text-right' },
  { field: 'returnPct', label: 'Return %', align: 'text-right' }
] as const

function SortArrow({ active, direction }: { readonly active: boolean; readonly direction: SortDirection }) {
  if (!active) return <span className="text-sv-text-muted ml-1 opacity-0 group-hover:opacity-50">&#9650;</span>
  return <span className="text-sv-accent ml-1">{direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
}

function ShortTermBadge() {
  return (
    <span
      className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/25"
      title="Short-term: held less than 1 year (potential higher tax rate)"
    >
      ST
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-sv-text mb-2">
          No closed trades
        </h2>
        <p className="text-sm text-sv-text-muted max-w-sm">
          When you sell all shares of a position, it will appear here with your realized P&L.
        </p>
      </div>
    </div>
  )
}

interface ClosedRowProps {
  readonly item: EnrichedClosed
  readonly onClick: (ticker: string) => void
  readonly striped: boolean
}

function ClosedRow({ item, onClick, striped }: ClosedRowProps) {
  const { position, returnPct, holdingPeriodLabel, isShortTerm } = item

  return (
    <tr
      className={`border-b border-sv-border/50 cursor-pointer transition-colors hover:bg-sv-elevated ${striped ? 'bg-sv-bg' : 'bg-sv-surface'}`}
      onClick={() => onClick(position.ticker)}
    >
      <td className="px-4 py-3 font-semibold text-sv-accent">{position.ticker}</td>
      <td className="px-4 py-3 text-sv-text-secondary truncate max-w-[200px]" title={position.companyName}>{position.companyName}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sv-text">
        {position.lastSellDate ? formatDate(position.lastSellDate) : '--'}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sv-text">
        {holdingPeriodLabel}
        {isShortTerm && <ShortTermBadge />}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-sv-text">
        {formatCurrency(position.totalInvested)}
      </td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums ${getGainClass(position.totalRealized)}`}>
        {formatSignedCurrency(position.totalRealized)}
      </td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums ${getGainClass(returnPct)}`}>
        {formatPercent(returnPct)}
      </td>
    </tr>
  )
}

export function ClosedPositionsView() {
  const positions = useAppStore((state) => state.positions)
  const setSelectedTicker = useAppStore((s) => s.setSelectedTicker)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const [sort, setSort] = useState<SortState>({ field: 'returnPct', direction: 'desc' })

  const closedPositions = useMemo(
    () => positions.filter((p) => p.status === 'CLOSED'),
    [positions]
  )

  const enriched = useMemo(
    () => closedPositions.map(enrichClosedPosition),
    [closedPositions]
  )

  const sorted = useMemo(() => {
    const items = [...enriched]
    items.sort((a, b) =>
      compareValues(getSortValue(a, sort.field), getSortValue(b, sort.field), sort.direction)
    )
    return items
  }, [enriched, sort])

  const { totalRealized, totalInvested } = useMemo(() => ({
    totalRealized: closedPositions.reduce((sum, p) => sum + p.totalRealized, 0),
    totalInvested: closedPositions.reduce((sum, p) => sum + p.totalInvested, 0)
  }), [closedPositions])

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

  if (closedPositions.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-sv-text">Closed Trades</h1>
        <div className="flex items-baseline gap-4 text-sm">
          <span className="text-sv-text-muted">
            Total Invested: <span className="font-mono tabular-nums text-sv-text">{formatCurrency(totalInvested)}</span>
          </span>
          <span className="text-sv-text-muted">
            Total Realized P&L:{' '}
            <span className={`font-mono tabular-nums ${getGainClass(totalRealized)}`}>
              {formatSignedCurrency(totalRealized)}
            </span>
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-sv-surface border border-sv-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sv-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.field}
                  className={`px-4 py-2.5 font-medium text-sv-text-muted text-xs uppercase tracking-wider cursor-pointer select-none group ${col.align}`}
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
              <ClosedRow
                key={item.position.ticker}
                item={item}
                onClick={handleRowClick}
                striped={idx % 2 !== 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
