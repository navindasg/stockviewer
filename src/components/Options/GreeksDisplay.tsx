import type { PositionGreeks } from '../../types/index'

interface GreeksDisplayProps {
  readonly greeks: PositionGreeks
  readonly compact?: boolean
}

interface GreekItem {
  readonly label: string
  readonly symbol: string
  readonly value: number | null
  readonly format: (v: number) => string
  readonly color: string
}

function formatGreekValue(value: number): string {
  return value.toFixed(4)
}

function formatThetaValue(value: number): string {
  return value.toFixed(2)
}

export function GreeksDisplay({ greeks, compact = false }: GreeksDisplayProps) {
  const items: ReadonlyArray<GreekItem> = [
    {
      label: 'Delta',
      symbol: '\u0394',
      value: greeks.delta,
      format: formatGreekValue,
      color: 'text-sv-accent'
    },
    {
      label: 'Gamma',
      symbol: '\u0393',
      value: greeks.gamma,
      format: formatGreekValue,
      color: 'text-purple-400'
    },
    {
      label: 'Theta',
      symbol: '\u0398',
      value: greeks.theta,
      format: formatThetaValue,
      color: 'text-sv-negative'
    },
    {
      label: 'Vega',
      symbol: '\u03BD',
      value: greeks.vega,
      format: formatGreekValue,
      color: 'text-emerald-400'
    }
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {items.map((item) => (
          <span key={item.label} className="text-xs font-mono tabular-nums" title={item.label}>
            <span className={`${item.color} font-medium`}>{item.symbol}</span>
            {' '}
            <span className="text-sv-text-secondary">
              {item.value !== null ? item.format(item.value) : 'N/A'}
            </span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-sv-surface rounded-lg border border-sv-border px-3 py-2 text-center"
        >
          <p className="text-xs text-sv-text-muted mb-1">{item.label}</p>
          <p className={`text-sm font-mono tabular-nums font-semibold ${item.color}`}>
            <span className="mr-1">{item.symbol}</span>
            {item.value !== null ? item.format(item.value) : 'N/A'}
          </p>
        </div>
      ))}
    </div>
  )
}
