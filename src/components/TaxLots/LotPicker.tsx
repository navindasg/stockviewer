import { useState, useMemo, useCallback, useEffect } from 'react'
import type { TaxLot } from '../../types/index'
import { formatCurrency, formatDate, formatShares } from '../../utils/formatters'
import { isShortTermHolding } from '../../utils/holdingPeriod'

interface LotSelection {
  readonly lotId: string
  readonly shares: number
}

interface LotPickerProps {
  readonly ticker: string
  readonly sharesToSell: number
  readonly onSelectionsChange: (selections: ReadonlyArray<LotSelection>) => void
  readonly isVisible: boolean
}

export function LotPicker({ ticker, sharesToSell, onSelectionsChange, isVisible }: LotPickerProps) {
  const [availableLots, setAvailableLots] = useState<ReadonlyArray<TaxLot>>([])
  const [loading, setLoading] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isVisible || !ticker) return

    let cancelled = false
    setLoading(true)
    window.electronAPI
      .getAvailableLots(ticker)
      .then((lots) => {
        if (!cancelled) {
          setAvailableLots(lots)
          setAllocations({})
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableLots([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [ticker, isVisible])

  const totalAllocated = useMemo(() => {
    let total = 0
    for (const val of Object.values(allocations)) {
      const num = parseFloat(val)
      if (!isNaN(num) && num > 0) total += num
    }
    return total
  }, [allocations])

  const remaining = sharesToSell - totalAllocated

  const selections = useMemo((): ReadonlyArray<LotSelection> => {
    const result: LotSelection[] = []
    for (const [lotId, val] of Object.entries(allocations)) {
      const shares = parseFloat(val)
      if (!isNaN(shares) && shares > 0) {
        result.push({ lotId, shares })
      }
    }
    return result
  }, [allocations])

  useEffect(() => {
    onSelectionsChange(selections)
  }, [selections, onSelectionsChange])

  const handleAllocationChange = useCallback((lotId: string, value: string) => {
    setAllocations((prev) => ({ ...prev, [lotId]: value }))
  }, [])

  const handleFillFromLot = useCallback((lotId: string, maxShares: number) => {
    const toFill = Math.min(maxShares, remaining > 0 ? remaining : 0)
    if (toFill > 0) {
      setAllocations((prev) => ({ ...prev, [lotId]: String(toFill) }))
    }
  }, [remaining])

  if (!isVisible) return null

  if (loading) {
    return (
      <div className="rounded-md border border-sv-border bg-sv-surface p-3">
        <p className="text-xs text-sv-text-muted">Loading available lots...</p>
      </div>
    )
  }

  if (availableLots.length === 0) {
    return (
      <div className="rounded-md border border-sv-border bg-sv-surface p-3">
        <p className="text-xs text-sv-text-muted">No available lots for {ticker}.</p>
      </div>
    )
  }

  const tolerance = 0.0001
  const isBalanced = Math.abs(remaining) < tolerance

  return (
    <div className="rounded-md border border-sv-border bg-sv-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-sv-text">Select Tax Lots to Sell</h4>
        <span className={`text-xs font-mono tabular-nums ${isBalanced ? 'text-sv-positive' : remaining < 0 ? 'text-sv-negative' : 'text-sv-text-muted'}`}>
          {isBalanced
            ? 'Fully allocated'
            : remaining > 0
              ? `${formatShares(remaining)} remaining`
              : `${formatShares(Math.abs(remaining))} over-allocated`
          }
        </span>
      </div>

      <div className="space-y-1.5">
        {availableLots.map((lot) => {
          const shortTerm = isShortTermHolding(lot.acquisitionDate)
          const currentAlloc = allocations[lot.id] ?? ''
          const allocNum = parseFloat(currentAlloc)
          const isOverAllocated = !isNaN(allocNum) && allocNum > lot.remainingShares

          return (
            <div
              key={lot.id}
              className="flex items-center gap-2 rounded bg-sv-bg px-2 py-1.5 border border-sv-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono tabular-nums text-sv-text">
                    {formatDate(lot.acquisitionDate)}
                  </span>
                  <span className="text-sv-text-muted">
                    {formatShares(lot.remainingShares)} @ {formatCurrency(lot.costPerShare)}
                  </span>
                  <span
                    className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                      shortTerm
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    }`}
                  >
                    {shortTerm ? 'ST' : 'LT'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentAlloc}
                  onChange={(e) => handleAllocationChange(lot.id, e.target.value)}
                  min="0"
                  max={lot.remainingShares}
                  step="any"
                  placeholder="0"
                  className={`w-20 bg-sv-elevated border rounded px-1.5 py-0.5 text-xs font-mono tabular-nums text-sv-text text-right focus:outline-none focus:ring-1 focus:ring-sv-accent ${
                    isOverAllocated ? 'border-sv-negative' : 'border-sv-border'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleFillFromLot(lot.id, lot.remainingShares)}
                  className="text-[10px] text-sv-accent hover:text-sv-accent/80 transition-colors cursor-pointer px-1"
                  title="Fill remaining from this lot"
                >
                  Fill
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!isBalanced && totalAllocated > 0 && (
        <p className="mt-2 text-[10px] text-sv-negative">
          Allocated shares must equal shares to sell ({formatShares(sharesToSell)})
        </p>
      )}
    </div>
  )
}
