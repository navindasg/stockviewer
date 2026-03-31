export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL' | 'HOLD'

interface ChartControlsProps {
  readonly selectedRange: TimeRange
  readonly onRangeChange: (range: TimeRange) => void
  readonly hasHoldingPeriod: boolean
}

const RANGE_OPTIONS: ReadonlyArray<{ readonly value: TimeRange; readonly label: string }> = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' },
  { value: 'HOLD', label: 'HOLD' }
]

export function ChartControls({
  selectedRange,
  onRangeChange,
  hasHoldingPeriod
}: ChartControlsProps) {
  const visibleOptions = hasHoldingPeriod
    ? RANGE_OPTIONS
    : RANGE_OPTIONS.filter((opt) => opt.value !== 'HOLD')

  return (
    <div className="flex gap-1">
      {visibleOptions.map((option) => {
        const isActive = selectedRange === option.value
        return (
          <button
            key={option.value}
            onClick={() => onRangeChange(option.value)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
              isActive
                ? 'bg-sv-accent text-white'
                : 'bg-transparent text-sv-text-secondary hover:bg-sv-elevated'
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
