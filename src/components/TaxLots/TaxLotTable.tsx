import { useState, useMemo, useCallback } from 'react'
import type { TaxLot, Quote } from '../../types/index'
import { formatCurrency, formatSignedCurrency, formatDate, formatShares } from '../../utils/formatters'
import { isShortTermHolding } from '../../utils/holdingPeriod'

type SortField = 'acquisitionDate' | 'shares' | 'remainingShares' | 'costPerShare' | 'totalCost' | 'currentValue' | 'gainLoss'
type SortDirection = 'asc' | 'desc'

interface SortState {
  readonly field: SortField
  readonly direction: SortDirection
}

interface EnrichedLot {
  readonly lot: TaxLot
  readonly totalCost: number
  readonly currentValue: number
  readonly gainLoss: number
  readonly gainLossPct: number
  readonly isShortTerm: boolean
}

interface TaxLotTableProps {
  readonly lots: ReadonlyArray<TaxLot>
  readonly quote: Quote | null
  readonly loading: boolean
}

function enrichLot(lot: TaxLot, currentPrice: number): EnrichedLot {
  const totalCost = lot.remainingShares * lot.costPerShare
  const currentValue = lot.remainingShares * currentPrice
  const gainLoss = currentValue - totalCost
  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0

  return { lot, totalCost, currentValue, gainLoss, gainLossPct, isShortTerm: isShortTermHolding(lot.acquisitionDate) }
}

function getGainClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

function getSortValue(item: EnrichedLot, field: SortField): number | string {
  switch (field) {
    case 'acquisitionDate': return item.lot.acquisitionDate
    case 'shares': return item.lot.shares
    case 'remainingShares': return item.lot.remainingShares
    case 'costPerShare': return item.lot.costPerShare
    case 'totalCost': return item.totalCost
    case 'currentValue': return item.currentValue
    case 'gainLoss': return item.gainLoss
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
  { field: 'acquisitionDate', label: 'Acquired', align: 'text-left' },
  { field: 'shares', label: 'Original', align: 'text-right' },
  { field: 'remainingShares', label: 'Remaining', align: 'text-right' },
  { field: 'costPerShare', label: 'Cost/Share', align: 'text-right' },
  { field: 'totalCost', label: 'Cost Basis', align: 'text-right' },
  { field: 'currentValue', label: 'Mkt Value', align: 'text-right' },
  { field: 'gainLoss', label: 'Gain/Loss', align: 'text-right' }
]

function SortArrow({ active, direction }: { readonly active: boolean; readonly direction: SortDirection }) {
  if (!active) return <span className="text-sv-text-muted ml-1 opacity-0 group-hover:opacity-50">&#9650;</span>
  return <span className="text-sv-accent ml-1">{direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
}

function TermBadge({ isShortTerm }: { readonly isShortTerm: boolean }) {
  if (isShortTerm) {
    return (
      <span
        className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/25"
        title="Short-term: held less than 1 year"
      >
        ST
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
      title="Long-term: held 1 year or more"
    >
      LT
    </span>
  )
}

export function TaxLotTable({ lots, quote, loading }: TaxLotTableProps) {
  const [sort, setSort] = useState<SortState>({ field: 'acquisitionDate', direction: 'asc' })

  const currentPrice = quote?.price ?? 0

  const openLots = useMemo(
    () => lots.filter((l) => l.remainingShares > 0),
    [lots]
  )

  const enriched = useMemo(
    () => openLots.map((l) => enrichLot(l, currentPrice)),
    [openLots, currentPrice]
  )

  const sorted = useMemo(() => {
    const items = [...enriched]
    items.sort((a, b) =>
      compareValues(getSortValue(a, sort.field), getSortValue(b, sort.field), sort.direction)
    )
    return items
  }, [enriched, sort])

  const totals = useMemo(() => {
    let totalCost = 0
    let totalValue = 0
    for (const item of enriched) {
      totalCost += item.totalCost
      totalValue += item.currentValue
    }
    return { totalCost, totalValue, gainLoss: totalValue - totalCost }
  }, [enriched])

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  if (loading) {
    return (
      <div className="bg-sv-surface rounded-lg border border-sv-border p-4">
        <h3 className="text-sv-text text-sm font-semibold mb-2">Tax Lots</h3>
        <p className="text-sv-text-muted text-xs">Loading tax lots...</p>
      </div>
    )
  }

  if (openLots.length === 0) {
    return (
      <div className="bg-sv-surface rounded-lg border border-sv-border p-4">
        <h3 className="text-sv-text text-sm font-semibold mb-2">Tax Lots</h3>
        <p className="text-sv-text-muted text-xs">No open tax lots for this position.</p>
      </div>
    )
  }

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sv-border">
        <h3 className="text-sv-text text-sm font-semibold">
          Tax Lots <span className="text-sv-text-muted font-normal">({openLots.length})</span>
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-sv-text-muted">
            Total Cost: <span className="font-mono tabular-nums text-sv-text">{formatCurrency(totals.totalCost)}</span>
          </span>
          <span className="text-sv-text-muted">
            Unrealized:{' '}
            <span className={`font-mono tabular-nums ${getGainClass(totals.gainLoss)}`}>
              {formatSignedCurrency(totals.gainLoss)}
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-sv-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.field}
                  className={`px-3 py-2 font-medium text-sv-text-muted uppercase tracking-wider cursor-pointer select-none group ${col.align}`}
                  onClick={() => handleSort(col.field)}
                >
                  {col.label}
                  <SortArrow active={sort.field === col.field} direction={sort.direction} />
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-sv-text-muted uppercase tracking-wider text-center">Term</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, idx) => (
              <tr
                key={item.lot.id}
                className={`border-b border-sv-border/50 ${idx % 2 !== 0 ? 'bg-sv-bg' : 'bg-sv-surface'}`}
              >
                <td className="px-3 py-2 font-mono tabular-nums text-sv-text">
                  {formatDate(item.lot.acquisitionDate)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-sv-text-secondary">
                  {formatShares(item.lot.shares)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-sv-text">
                  {formatShares(item.lot.remainingShares)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-sv-text">
                  {formatCurrency(item.lot.costPerShare)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-sv-text">
                  {formatCurrency(item.totalCost)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-sv-text">
                  {formatCurrency(item.currentValue)}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${getGainClass(item.gainLoss)}`}>
                  {formatSignedCurrency(item.gainLoss)}
                </td>
                <td className="px-3 py-2 text-center">
                  <TermBadge isShortTerm={item.isShortTerm} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
