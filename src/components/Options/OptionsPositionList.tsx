import { useState } from 'react'
import { formatCurrency, formatSignedCurrency, formatDate } from '../../utils/formatters'
import { formatOccSymbol } from '../../utils/occSymbol'
import type { OptionPosition, Quote } from '../../types/index'

interface OptionsPositionListProps {
  readonly positions: ReadonlyArray<OptionPosition>
  readonly quotes: Readonly<Record<string, Quote>>
  readonly onViewChain: (ticker: string) => void
}

type SortField = 'ticker' | 'type' | 'strike' | 'expiration' | 'contracts' | 'pnl' | 'dte'
type SortDirection = 'asc' | 'desc'

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'bg-sv-positive/15 text-sv-positive'
    case 'CLOSED':
      return 'bg-sv-text-muted/15 text-sv-text-muted'
    case 'EXPIRED':
      return 'bg-sv-negative/15 text-sv-negative'
    default:
      return 'bg-sv-text-muted/15 text-sv-text-muted'
  }
}

function getDirectionBadgeClass(direction: string): string {
  return direction === 'LONG'
    ? 'bg-sv-positive/15 text-sv-positive'
    : 'bg-amber-600/15 text-amber-500'
}

export function OptionsPositionList({ positions, quotes, onViewChain }: OptionsPositionListProps) {
  const [sortField, setSortField] = useState<SortField>('expiration')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sorted = [...positions].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1
    switch (sortField) {
      case 'ticker':
        return dir * a.underlyingTicker.localeCompare(b.underlyingTicker)
      case 'type':
        return dir * a.optionType.localeCompare(b.optionType)
      case 'strike':
        return dir * (a.strikePrice - b.strikePrice)
      case 'expiration':
        return dir * a.expirationDate.localeCompare(b.expirationDate)
      case 'contracts':
        return dir * (a.openContracts - b.openContracts)
      case 'pnl':
        return dir * (a.realizedPnl - b.realizedPnl)
      case 'dte':
        return dir * (a.daysToExpiration - b.daysToExpiration)
      default:
        return 0
    }
  })

  // Group by underlying ticker
  const grouped = new Map<string, ReadonlyArray<OptionPosition>>()
  for (const pos of sorted) {
    const existing = grouped.get(pos.underlyingTicker) ?? []
    grouped.set(pos.underlyingTicker, [...existing, pos])
  }

  function SortHeader({ field, label, className }: { readonly field: SortField; readonly label: string; readonly className?: string }) {
    const isActive = sortField === field
    return (
      <th
        className={`px-3 py-2 text-left text-xs font-medium text-sv-text-muted uppercase tracking-wider cursor-pointer hover:text-sv-text select-none ${className ?? ''}`}
        onClick={() => handleSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          {isActive && (
            <span className="text-sv-accent">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
          )}
        </span>
      </th>
    )
  }

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-sv-elevated border-b border-sv-border">
          <tr>
            <SortHeader field="ticker" label="Contract" className="w-56" />
            <SortHeader field="type" label="Type" />
            <th className="px-3 py-2 text-left text-xs font-medium text-sv-text-muted uppercase tracking-wider">Dir</th>
            <SortHeader field="strike" label="Strike" />
            <SortHeader field="expiration" label="Expiration" />
            <SortHeader field="dte" label="DTE" />
            <SortHeader field="contracts" label="Contracts" />
            <th className="px-3 py-2 text-right text-xs font-medium text-sv-text-muted uppercase tracking-wider">Avg Cost</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-sv-text-muted uppercase tracking-wider">Mkt Price</th>
            <SortHeader field="pnl" label="P&L" className="text-right" />
            <th className="px-3 py-2 text-left text-xs font-medium text-sv-text-muted uppercase tracking-wider">Status</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-sv-text-muted uppercase tracking-wider w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sv-border">
          {Array.from(grouped.entries()).map(([ticker, tickerPositions]) => (
            tickerPositions.map((pos, idx) => {
              // Option price requires chain data; underlying stock price is not the option price
              const hasPnl = pos.status !== 'OPEN'
              const displayPnl = hasPnl ? pos.realizedPnl : null
              const pnlColor = displayPnl !== null
                ? (displayPnl >= 0 ? 'text-sv-positive' : 'text-sv-negative')
                : 'text-sv-text-muted'

              return (
                <tr
                  key={pos.occSymbol}
                  className="hover:bg-sv-elevated/50 transition-colors"
                >
                  <td className="px-3 py-2">
                    {idx === 0 && (
                      <div className="text-xs text-sv-text-muted mb-0.5">{ticker} - {pos.companyName}</div>
                    )}
                    <span className="text-sm font-mono tabular-nums text-sv-text">
                      {formatOccSymbol(pos.occSymbol)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                      pos.optionType === 'CALL' ? 'bg-sv-positive/15 text-sv-positive' : 'bg-sv-negative/15 text-sv-negative'
                    }`}>
                      {pos.optionType}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getDirectionBadgeClass(pos.direction)}`}>
                      {pos.direction}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-sm text-sv-text">
                    {formatCurrency(pos.strikePrice)}
                  </td>
                  <td className="px-3 py-2 text-sm text-sv-text-secondary">
                    {formatDate(pos.expirationDate)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-sm text-sv-text-secondary">
                    {pos.status === 'OPEN' ? (
                      <span className={pos.daysToExpiration <= 7 ? 'text-sv-negative font-medium' : ''}>
                        {pos.daysToExpiration}d
                      </span>
                    ) : (
                      <span className="text-sv-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-sm text-sv-text">
                    {pos.openContracts}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-sm text-sv-text">
                    {formatCurrency(pos.avgCostPerContract / pos.contractMultiplier)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-sm text-sv-text-muted">
                    <span title="Requires chain data">-</span>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono tabular-nums text-sm ${pnlColor}`}>
                    {displayPnl !== null ? formatSignedCurrency(displayPnl) : 'N/A'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClass(pos.status)}`}>
                      {pos.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onViewChain(pos.underlyingTicker)}
                      className="text-sv-text-muted hover:text-sv-accent transition-colors cursor-pointer"
                      title="View options chain"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })
          ))}
        </tbody>
      </table>
    </div>
  )
}
