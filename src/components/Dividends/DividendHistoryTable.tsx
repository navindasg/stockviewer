import { useState, useMemo } from 'react'
import { formatCurrency, formatDate, formatShares } from '../../utils/formatters'
import type { Dividend } from '../../types/index'

type SortField = 'exDate' | 'ticker' | 'amountPerShare' | 'totalAmount' | 'type'
type SortDirection = 'asc' | 'desc'

interface DividendHistoryTableProps {
  readonly dividends: ReadonlyArray<Dividend>
  readonly isLoading: boolean
  readonly onDelete?: (id: string) => void
  readonly showTicker?: boolean
}

function DividendTypeBadge({ type }: { readonly type: Dividend['type'] }) {
  const isCash = type === 'CASH'
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
        ${isCash
          ? 'bg-sv-accent/10 text-sv-accent'
          : 'bg-sv-positive/10 text-sv-positive'
        }
      `}
    >
      {isCash ? 'Cash' : 'DRIP'}
    </span>
  )
}

function SortIcon({ active, direction }: { readonly active: boolean; readonly direction: SortDirection }) {
  if (!active) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-30">
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

export function DividendHistoryTable({
  dividends,
  isLoading,
  onDelete,
  showTicker = true
}: DividendHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('exDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sorted = useMemo(() => {
    return [...dividends].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'exDate':
          cmp = a.exDate.localeCompare(b.exDate)
          break
        case 'ticker':
          cmp = a.ticker.localeCompare(b.ticker)
          break
        case 'amountPerShare':
          cmp = a.amountPerShare - b.amountPerShare
          break
        case 'totalAmount':
          cmp = a.totalAmount - b.totalAmount
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [dividends, sortField, sortDirection])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-sv-surface rounded-lg border border-sv-border p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-sv-elevated rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (dividends.length === 0) {
    return (
      <div className="bg-sv-surface rounded-lg border border-sv-border p-8 text-center">
        <p className="text-sv-text-muted text-sm">No dividend payments recorded yet.</p>
      </div>
    )
  }

  function HeaderCell({ field, label }: { readonly field: SortField; readonly label: string }) {
    return (
      <th
        className="px-3 py-2 text-left text-xs font-medium text-sv-text-muted uppercase tracking-wider cursor-pointer hover:text-sv-text transition-colors select-none"
        onClick={() => toggleSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon active={sortField === field} direction={sortDirection} />
        </span>
      </th>
    )
  }

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sv-border">
              {showTicker && <HeaderCell field="ticker" label="Ticker" />}
              <HeaderCell field="exDate" label="Ex-Date" />
              <th className="px-3 py-2 text-left text-xs font-medium text-sv-text-muted uppercase tracking-wider">Pay Date</th>
              <HeaderCell field="type" label="Type" />
              <HeaderCell field="amountPerShare" label="Per Share" />
              <th className="px-3 py-2 text-right text-xs font-medium text-sv-text-muted uppercase tracking-wider">Shares</th>
              <HeaderCell field="totalAmount" label="Total" />
              {onDelete && (
                <th className="px-3 py-2 text-right text-xs font-medium text-sv-text-muted uppercase tracking-wider w-10" />
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((div) => (
              <tr
                key={div.id}
                className="border-b border-sv-border/50 hover:bg-sv-elevated/50 transition-colors"
              >
                {showTicker && (
                  <td className="px-3 py-2 text-sm font-semibold text-sv-text">{div.ticker}</td>
                )}
                <td className="px-3 py-2 text-sm text-sv-text-secondary">{formatDate(div.exDate)}</td>
                <td className="px-3 py-2 text-sm text-sv-text-secondary">{formatDate(div.payDate)}</td>
                <td className="px-3 py-2"><DividendTypeBadge type={div.type} /></td>
                <td className="px-3 py-2 text-sm font-mono tabular-nums text-sv-text text-right">
                  ${div.amountPerShare.toFixed(4)}
                </td>
                <td className="px-3 py-2 text-sm font-mono tabular-nums text-sv-text-secondary text-right">
                  {formatShares(div.sharesAtDate)}
                </td>
                <td className="px-3 py-2 text-sm font-mono tabular-nums font-semibold text-sv-positive text-right">
                  {formatCurrency(div.totalAmount)}
                </td>
                {onDelete && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(div.id)}
                      className="text-sv-text-muted hover:text-sv-negative transition-colors cursor-pointer"
                      title="Delete dividend"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1m2 0v7a1 1 0 01-1 1H4a1 1 0 01-1-1V4h10z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
