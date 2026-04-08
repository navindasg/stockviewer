import { useState, useMemo } from 'react'
import type { WatchlistItem, Quote } from '../../types/index'
import { WatchlistRow } from './WatchlistRow'

type SortField = 'ticker' | 'price' | 'dayChange' | 'dayChangePercent' | 'sortOrder'
type SortDirection = 'asc' | 'desc'

interface WatchlistTableProps {
  readonly items: ReadonlyArray<WatchlistItem>
  readonly quotes: Readonly<Record<string, Quote>>
  readonly onRemove: (id: string) => void
  readonly onEditNote: (item: WatchlistItem) => void
}

function SortIcon({ active, direction }: { readonly active: boolean; readonly direction: SortDirection }) {
  if (!active) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-sv-text-muted/40">
        <path d="M6 2L9 5H3L6 2Z" fill="currentColor" />
        <path d="M6 10L3 7H9L6 10Z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-sv-accent">
      {direction === 'asc' ? (
        <path d="M6 2L9 5H3L6 2Z" fill="currentColor" />
      ) : (
        <path d="M6 10L3 7H9L6 10Z" fill="currentColor" />
      )}
    </svg>
  )
}

function getQuoteValue(quote: Quote | undefined, field: SortField): number {
  if (!quote) return -Infinity
  switch (field) {
    case 'price':
      return quote.price
    case 'dayChange':
      return quote.dayChange
    case 'dayChangePercent':
      return quote.dayChangePercent
    default:
      return 0
  }
}

export function WatchlistTable({ items, quotes, onRemove, onEditNote }: WatchlistTableProps) {
  const [sortField, setSortField] = useState<SortField>('sortOrder')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'sortOrder' ? 'asc' : 'desc')
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1

      if (sortField === 'sortOrder') {
        return (a.sortOrder - b.sortOrder) * multiplier
      }

      if (sortField === 'ticker') {
        return a.ticker.localeCompare(b.ticker) * multiplier
      }

      const aVal = getQuoteValue(quotes[a.ticker], sortField)
      const bVal = getQuoteValue(quotes[b.ticker], sortField)
      return (aVal - bVal) * multiplier
    })

    return sorted
  }, [items, quotes, sortField, sortDirection])

  const headerClass =
    'px-4 py-2.5 text-xs font-medium text-sv-text-muted uppercase tracking-wider cursor-pointer hover:text-sv-text-secondary transition-colors select-none'

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-sv-border">
            <th className={`${headerClass} text-left`} onClick={() => handleSort('ticker')}>
              <div className="flex items-center gap-1">
                Ticker
                <SortIcon active={sortField === 'ticker'} direction={sortDirection} />
              </div>
            </th>
            <th className={`${headerClass} text-right`} onClick={() => handleSort('price')}>
              <div className="flex items-center justify-end gap-1">
                Price
                <SortIcon active={sortField === 'price'} direction={sortDirection} />
              </div>
            </th>
            <th className={`${headerClass} text-right`} onClick={() => handleSort('dayChange')}>
              <div className="flex items-center justify-end gap-1">
                Change
                <SortIcon active={sortField === 'dayChange'} direction={sortDirection} />
              </div>
            </th>
            <th className={`${headerClass} text-right`} onClick={() => handleSort('dayChangePercent')}>
              <div className="flex items-center justify-end gap-1">
                Change %
                <SortIcon active={sortField === 'dayChangePercent'} direction={sortDirection} />
              </div>
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-sv-text-muted uppercase tracking-wider text-left">
              7D
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-sv-text-muted uppercase tracking-wider text-left">
              Notes
            </th>
            <th className="px-4 py-2.5 w-[80px]" />
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => (
            <WatchlistRow
              key={item.id}
              item={item}
              quote={quotes[item.ticker] ?? null}
              onRemove={onRemove}
              onEditNote={onEditNote}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
