import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Scatter
} from 'recharts'
import { format, parseISO, sub } from 'date-fns'
import { useMarketData } from '../../hooks/useMarketData'
import { formatCurrency } from '../../utils/formatters'
import { ChartControls, type TimeRange } from './ChartControls'
import { ChartTooltip, type TransactionOnDay } from './ChartTooltip'
import { aggregateTransactionsByDate, type AggregatedMarker } from './BuySellMarkers'
import type { Transaction } from '../../types/index'

interface PriceChartProps {
  readonly ticker: string
  readonly transactions: ReadonlyArray<Transaction>
  readonly costBasis: number
  readonly color: string
}

interface ChartDataPoint {
  readonly date: string
  readonly close: number
  readonly transactions?: ReadonlyArray<TransactionOnDay>
  readonly markerPrice?: number
  readonly markerType?: 'BUY' | 'SELL' | 'MIXED'
}

function getStartDate(range: TimeRange, transactions: ReadonlyArray<Transaction>): Date {
  const now = new Date()

  switch (range) {
    case '1W':
      return sub(now, { weeks: 1 })
    case '1M':
      return sub(now, { months: 1 })
    case '3M':
      return sub(now, { months: 3 })
    case '6M':
      return sub(now, { months: 6 })
    case '1Y':
      return sub(now, { years: 1 })
    case 'ALL':
      return new Date('1970-01-01')
    case 'HOLD': {
      if (transactions.length === 0) {
        return sub(now, { years: 1 })
      }
      const sorted = [...transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      return new Date(sorted[0].date)
    }
  }
}

function formatXAxisTick(range: TimeRange): (dateStr: string) => string {
  return (dateStr: string) => {
    try {
      const d = parseISO(dateStr)
      if (range === '1W' || range === '1M') {
        return format(d, 'MMM dd')
      }
      return format(d, "MMM ''yy")
    } catch {
      return dateStr
    }
  }
}

function buildChartData(
  prices: ReadonlyArray<{ readonly date: string; readonly close: number }>,
  markers: ReadonlyArray<AggregatedMarker>,
  startDate: Date
): ReadonlyArray<ChartDataPoint> {
  const markerMap = new Map<string, AggregatedMarker>()
  for (const m of markers) {
    markerMap.set(m.date, m)
  }

  return prices
    .filter((p) => new Date(p.date) >= startDate)
    .map((p) => {
      const dateKey = p.date.slice(0, 10)
      const marker = markerMap.get(dateKey)

      const point: ChartDataPoint = {
        date: dateKey,
        close: p.close,
        ...(marker
          ? {
              transactions: marker.transactions,
              markerPrice: marker.price,
              markerType: marker.type
            }
          : {})
      }
      return point
    })
}

function renderMarkerDot(props: {
  cx?: number
  cy?: number
  payload?: ChartDataPoint
}) {
  const { cx, cy, payload } = props

  if (
    cx == null ||
    cy == null ||
    !payload?.markerType ||
    payload.markerPrice == null
  ) {
    return <circle r={0} />
  }

  const color =
    payload.markerType === 'BUY'
      ? '#22C55E'
      : payload.markerType === 'SELL'
        ? '#EF4444'
        : '#F59E0B'

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="#0A0E17"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
    />
  )
}

export function PriceChart({
  ticker,
  transactions,
  costBasis,
  color
}: PriceChartProps) {
  const hasHoldingPeriod = transactions.length > 0
  const [selectedRange, setSelectedRange] = useState<TimeRange>(
    hasHoldingPeriod ? 'HOLD' : '1Y'
  )

  const { historicalPrices, isLoading, fetchHistorical } = useMarketData(ticker)

  const startDate = useMemo(
    () => getStartDate(selectedRange, transactions),
    [selectedRange, transactions]
  )

  const fetchData = useCallback(() => {
    const fromStr = format(startDate, 'yyyy-MM-dd')
    const toStr = format(new Date(), 'yyyy-MM-dd')
    fetchHistorical(fromStr, toStr).catch(() => {
      // Error is already thrown inside useMarketData
    })
  }, [startDate, fetchHistorical])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const markers = useMemo(
    () => aggregateTransactionsByDate(transactions),
    [transactions]
  )

  const chartData = useMemo(
    () => buildChartData(historicalPrices, markers, startDate),
    [historicalPrices, markers, startDate]
  )

  const tickFormatter = useMemo(
    () => formatXAxisTick(selectedRange),
    [selectedRange]
  )

  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : null

  const yAxisFormatter = (value: number) => formatCurrency(value)

  if (isLoading && chartData.length === 0) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <ChartControls
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
            hasHoldingPeriod={hasHoldingPeriod}
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-sv-text-muted">Loading chart data...</span>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <ChartControls
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
            hasHoldingPeriod={hasHoldingPeriod}
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-sv-text-muted">No price data available</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <ChartControls
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
          hasHoldingPeriod={hasHoldingPeriod}
        />
        {lastPrice !== null && (
          <span
            className="text-sm font-medium text-sv-text"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrency(lastPrice)}
          </span>
        )}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData as ChartDataPoint[]}
            margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
          >
            <defs>
              <linearGradient id={`gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.1} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#1E2A3A"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              stroke="#6B7280"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              orientation="right"
              tickFormatter={yAxisFormatter}
              stroke="#6B7280"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              width={80}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: '#3B82F6', strokeOpacity: 0.3 }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke="none"
              fill={`url(#gradient-${ticker})`}
              animationDuration={300}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: '#0A0E17', strokeWidth: 2 }}
              animationDuration={300}
            />
            {costBasis > 0 && (
              <ReferenceLine
                y={costBasis}
                stroke="#FFFFFF"
                strokeOpacity={0.5}
                strokeDasharray="8 4"
                label={{
                  value: 'Avg Cost',
                  position: 'left',
                  fill: '#9CA3AF',
                  fontSize: 11
                }}
              />
            )}
            <Scatter
              dataKey="markerPrice"
              shape={renderMarkerDot}
              animationDuration={300}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
