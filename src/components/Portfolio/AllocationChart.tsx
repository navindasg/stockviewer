import { useMemo, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import type { Position, Quote } from '../../types/index'
import { formatCurrency, formatPercent } from '../../utils/formatters'

interface AllocationChartProps {
  readonly positions: ReadonlyArray<Position>
  readonly quotes: Readonly<Record<string, Quote>>
}

interface SliceData {
  readonly ticker: string
  readonly value: number
  readonly color: string
  readonly percent: number
}

function buildSlices(
  positions: ReadonlyArray<Position>,
  quotes: Readonly<Record<string, Quote>>
): ReadonlyArray<SliceData> {
  const openPositions = positions.filter((p) => p.status === 'OPEN' && p.totalShares > 0)

  const withValues = openPositions.map((p) => {
    const quote = quotes[p.ticker]
    const marketValue = quote ? quote.price * p.totalShares : p.costBasis * p.totalShares
    return { ticker: p.ticker, value: marketValue, color: p.color }
  })

  const total = withValues.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return []

  return withValues
    .map((s) => ({ ...s, percent: (s.value / total) * 100 }))
    .sort((a, b) => b.value - a.value)
}

interface CustomTooltipProps {
  readonly active?: boolean
  readonly payload?: ReadonlyArray<{ readonly payload: SliceData }>
}

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null

  const data = payload[0].payload
  return (
    <div className="rounded bg-sv-elevated border border-sv-border px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-sv-text">{data.ticker}</p>
      <p className="text-xs font-mono tabular-nums text-sv-text-secondary">
        {formatCurrency(data.value)}
      </p>
      <p className="text-xs font-mono tabular-nums text-sv-text-muted">
        {formatPercent(data.percent)}
      </p>
    </div>
  )
}

function CenterLabel({ totalValue }: { readonly totalValue: number }) {
  return (
    <text
      x="50%"
      y="50%"
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-sv-text"
    >
      <tspan
        x="50%"
        dy="-0.4em"
        fontSize="11"
        className="fill-sv-text-muted"
      >
        Total
      </tspan>
      <tspan
        x="50%"
        dy="1.4em"
        fontSize="14"
        fontWeight="600"
        fontFamily="'JetBrains Mono', monospace"
      >
        {formatCurrency(totalValue)}
      </tspan>
    </text>
  )
}

export function AllocationChart({ positions, quotes }: AllocationChartProps) {
  const slices = useMemo(() => buildSlices(positions, quotes), [positions, quotes])

  const totalValue = useMemo(
    () => slices.reduce((sum, s) => sum + s.value, 0),
    [slices]
  )

  const renderLabel = useCallback(
    (entry: SliceData) => (entry.percent >= 5 ? entry.ticker : ''),
    []
  )

  if (slices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sv-text-muted text-sm">
        No position data available
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-sv-surface border border-sv-border p-4">
      <h3 className="text-sm font-semibold text-sv-text mb-3">
        Portfolio Allocation
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={slices as SliceData[]}
            dataKey="value"
            nameKey="ticker"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={1}
            label={renderLabel}
            labelLine={false}
          >
            {slices.map((s) => (
              <Cell key={s.ticker} fill={s.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <CenterLabel totalValue={totalValue} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {slices.map((s) => (
          <div key={s.ticker} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-sv-text-secondary">{s.ticker}</span>
            <span className="font-mono tabular-nums text-sv-text-muted">
              {formatPercent(s.percent)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
