import { useState, useCallback } from 'react'
import type { CostBasisMethod } from '../../types/index'

interface CostBasisMethodSelectorProps {
  readonly ticker: string
  readonly currentMethod: CostBasisMethod
  readonly onMethodChange: (ticker: string, method: CostBasisMethod) => Promise<void>
}

const METHOD_OPTIONS: ReadonlyArray<{ readonly value: CostBasisMethod; readonly label: string; readonly description: string }> = [
  { value: 'FIFO', label: 'FIFO', description: 'First In, First Out' },
  { value: 'LIFO', label: 'LIFO', description: 'Last In, First Out' },
  { value: 'AVGCOST', label: 'Avg Cost', description: 'Average Cost Basis' },
  { value: 'SPECIFIC', label: 'Specific ID', description: 'Choose Specific Lots' }
]

export function CostBasisMethodSelector({ ticker, currentMethod, onMethodChange }: CostBasisMethodSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleChange = useCallback(async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const method = event.target.value as CostBasisMethod
    if (method === currentMethod) return

    setIsUpdating(true)
    try {
      await onMethodChange(ticker, method)
    } catch (error) {
      throw new Error(
        `Failed to update cost basis method: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setIsUpdating(false)
    }
  }, [ticker, currentMethod, onMethodChange])

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={`cbm-${ticker}`}
        className="text-xs text-sv-text-muted whitespace-nowrap"
      >
        Cost Basis Method:
      </label>
      <select
        id={`cbm-${ticker}`}
        value={currentMethod}
        onChange={handleChange}
        disabled={isUpdating}
        className="bg-sv-elevated border border-sv-border rounded px-2 py-1 text-xs text-sv-text focus:outline-none focus:ring-1 focus:ring-sv-accent disabled:opacity-50 cursor-pointer"
      >
        {METHOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} — {opt.description}
          </option>
        ))}
      </select>
      {isUpdating && (
        <span className="text-xs text-sv-text-muted">Recomputing...</span>
      )}
    </div>
  )
}
