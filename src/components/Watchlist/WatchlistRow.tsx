import { useState, useCallback } from 'react'
import type { WatchlistItem, Quote } from '../../types/index'
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/formatters'
import { FlashValue } from '../common/FlashValue'
import { WatchlistSparkline } from './WatchlistSparkline'

interface WatchlistRowProps {
  readonly item: WatchlistItem
  readonly quote: Quote | null
  readonly onRemove: (id: string) => void
  readonly onEditNote: (item: WatchlistItem) => void
}

function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 6h6M5 8h6M5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function getDayChangeColor(change: number): string {
  if (change > 0) return 'text-sv-positive'
  if (change < 0) return 'text-sv-negative'
  return 'text-sv-text-secondary'
}

export function WatchlistRow({ item, quote, onRemove, onEditNote }: WatchlistRowProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)

  const handleRemoveClick = useCallback(() => {
    if (confirmRemove) {
      onRemove(item.id)
    } else {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
    }
  }, [confirmRemove, item.id, onRemove])

  const price = quote?.price ?? null
  const dayChange = quote?.dayChange ?? 0
  const dayChangePercent = quote?.dayChangePercent ?? 0
  const companyName = quote?.companyName ?? item.companyName
  const isOffline = quote?.offline === true
  const isStale = quote?.isStale === true

  return (
    <tr className="border-b border-sv-border/50 hover:bg-sv-elevated/30 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-sv-accent tabular-nums">
              {item.ticker}
            </span>
            {(isOffline || isStale) && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-sv-warning/10 text-sv-warning">
                {isOffline ? 'OFFLINE' : 'STALE'}
              </span>
            )}
          </div>
          <span className="text-xs text-sv-text-muted truncate max-w-[180px]">
            {companyName}
          </span>
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        {price !== null ? (
          <FlashValue value={price} className="font-mono text-sm tabular-nums text-sv-text">
            {formatCurrency(price)}
          </FlashValue>
        ) : (
          <span className="text-sm text-sv-text-muted">&mdash;</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <span className={`font-mono text-sm tabular-nums ${getDayChangeColor(dayChange)}`}>
          {price !== null ? formatSignedCurrency(dayChange) : '\u2014'}
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className={`font-mono text-sm tabular-nums ${getDayChangeColor(dayChangePercent)}`}>
          {price !== null ? formatPercent(dayChangePercent) : '\u2014'}
        </span>
      </td>

      <td className="px-4 py-3">
        <WatchlistSparkline ticker={item.ticker} dayChange={dayChange} />
      </td>

      <td className="px-4 py-3">
        {item.notes ? (
          <span className="text-xs text-sv-text-muted truncate max-w-[150px] block" title={item.notes}>
            {item.notes}
          </span>
        ) : (
          <span className="text-xs text-sv-text-muted/40">&mdash;</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEditNote(item)}
            className="p-1 rounded text-sv-text-muted hover:text-sv-accent hover:bg-sv-accent/10 transition-colors cursor-pointer"
            title="Edit note"
          >
            <NoteIcon />
          </button>
          <button
            onClick={handleRemoveClick}
            className={`p-1 rounded transition-colors cursor-pointer ${
              confirmRemove
                ? 'text-sv-negative bg-sv-negative/10'
                : 'text-sv-text-muted hover:text-sv-negative hover:bg-sv-negative/10'
            }`}
            title={confirmRemove ? 'Click again to confirm' : 'Remove from watchlist'}
          >
            <RemoveIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}
