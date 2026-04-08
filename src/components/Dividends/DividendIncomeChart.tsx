import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import type { Dividend } from '../../types/index'

interface DividendIncomeChartProps {
  readonly dividends: ReadonlyArray<Dividend>
}

interface MonthlyDataPoint {
  readonly month: string
  readonly cash: number
  readonly reinvested: number
  readonly total: number
}

function buildMonthlyData(dividends: ReadonlyArray<Dividend>): ReadonlyArray<MonthlyDataPoint> {
  if (dividends.length === 0) return []

  const monthMap = new Map<string, { cash: number; reinvested: number }>()

  for (const div of dividends) {
    const monthKey = div.payDate.substring(0, 7)
    const existing = monthMap.get(monthKey) ?? { cash: 0, reinvested: 0 }

    if (div.type === 'CASH') {
      monthMap.set(monthKey, { ...existing, cash: existing.cash + div.totalAmount })
    } else {
      monthMap.set(monthKey, { ...existing, reinvested: existing.reinvested + div.totalAmount })
    }
  }

  const sorted = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return sorted.map(([month, data]) => ({
    month: formatMonthLabel(month),
    cash: data.cash,
    reinvested: data.reinvested,
    total: data.cash + data.reinvested
  }))
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = parseInt(month, 10) - 1
  return `${months[monthIndex]} ${year.slice(2)}`
}

interface ChartTooltipProps {
  readonly active?: boolean
  readonly payload?: ReadonlyArray<{
    readonly name: string
    readonly value: number
    readonly color: string
  }>
  readonly label?: string
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const total = payload.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <div className="bg-sv-elevated border border-sv-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-sv-text-muted mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sv-text-secondary capitalize">{entry.name}</span>
          <span className="font-mono tabular-nums text-sv-text ml-auto">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center gap-2 text-xs mt-1 pt-1 border-t border-sv-border">
          <span className="text-sv-text-secondary font-medium">Total</span>
          <span className="font-mono tabular-nums text-sv-positive font-semibold ml-auto">
            {formatCurrency(total)}
          </span>
        </div>
      )}
    </div>
  )
}

export function DividendIncomeChart({ dividends }: DividendIncomeChartProps) {
  const data = useMemo(() => buildMonthlyData(dividends), [dividends])

  if (data.length === 0) {
    return (
      <div className="bg-sv-surface rounded-lg border border-sv-border p-8 text-center">
        <p className="text-sv-text-muted text-sm">No dividend data to chart.</p>
      </div>
    )
  }

  const hasReinvested = data.some((d) => d.reinvested > 0)

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border p-4">
      <h3 className="text-sm font-semibold text-sv-text mb-3">Monthly Dividend Income</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={[...data]} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1A2235" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1A2235' }}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
          <Bar
            dataKey="cash"
            name="cash"
            fill="#3B82F6"
            radius={hasReinvested ? [0, 0, 4, 4] : [4, 4, 4, 4]}
            stackId="income"
          />
          {hasReinvested && (
            <Bar
              dataKey="reinvested"
              name="reinvested"
              fill="#22C55E"
              radius={[4, 4, 0, 0]}
              stackId="income"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
