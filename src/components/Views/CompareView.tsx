import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useAppStore } from '../../stores/appStore'
import { getTickerColor } from '../../utils/colors'
import type { PricePoint } from '../../types/index'
import {
  type CompareTimeRange,
  COMPARE_RANGES,
  getCompareStartDate,
  getTodayStr,
  normalizePriceSeries,
  formatXAxis,
  formatYAxis,
  MAX_SELECTIONS,
  MIN_SELECTIONS
} from './compareUtils'

interface TickerPillProps {
  readonly ticker: string
  readonly color: string
  readonly selected: boolean
  readonly disabled: boolean
  readonly onToggle: (ticker: string) => void
}

function TickerPill({ ticker, color, selected, disabled, onToggle }: TickerPillProps) {
  const handleClick = () => {
    if (disabled && !selected) return
    onToggle(ticker)
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled && !selected}
      className={[
        'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 border',
        selected
          ? 'text-white'
          : disabled
            ? 'border-sv-border text-sv-text-muted cursor-not-allowed opacity-40'
            : 'border-sv-border text-sv-text-secondary hover:bg-sv-elevated'
      ].join(' ')}
      style={selected ? { backgroundColor: color, borderColor: color } : {}}
    >
      {ticker}
    </button>
  )
}

function CompareTooltipContent({ active, payload, label }: {
  readonly active?: boolean
  readonly payload?: ReadonlyArray<{ readonly dataKey: string; readonly value: number; readonly color: string }>
  readonly label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-sv-border bg-sv-elevated p-3 shadow-lg">
      <p className="mb-2 text-xs text-sv-text-muted">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sv-text-secondary">{entry.dataKey}</span>
          <span
            className={[
              'ml-auto font-mono tabular-nums',
              entry.value >= 0 ? 'text-sv-positive' : 'text-sv-negative'
            ].join(' ')}
          >
            {entry.value >= 0 ? '+' : ''}{entry.value.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

interface LegendEntryProps {
  readonly ticker: string
  readonly color: string
  readonly currentValue: number | undefined
}

function LegendEntry({ ticker, color, currentValue }: LegendEntryProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium text-sv-text">{ticker}</span>
      {currentValue != null && (
        <span
          className={[
            'text-xs font-mono tabular-nums',
            currentValue >= 0 ? 'text-sv-positive' : 'text-sv-negative'
          ].join(' ')}
        >
          {currentValue >= 0 ? '+' : ''}{currentValue.toFixed(2)}%
        </span>
      )}
    </div>
  )
}

export function CompareView() {
  const positions = useAppStore((s) => s.positions)
  const openPositions = useMemo(
    () => positions.filter((p) => p.status === 'OPEN'),
    [positions]
  )

  const [selectedTickers, setSelectedTickers] = useState<ReadonlyArray<string>>([])
  const [selectedRange, setSelectedRange] = useState<CompareTimeRange>('3M')
  const [priceData, setPriceData] = useState<Readonly<Record<string, ReadonlyArray<PricePoint>>>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = useCallback((ticker: string) => {
    setSelectedTickers((prev) => {
      const exists = prev.includes(ticker)
      if (exists) {
        return prev.filter((t) => t !== ticker)
      }
      if (prev.length >= MAX_SELECTIONS) return prev
      return [...prev, ticker]
    })
  }, [])

  useEffect(() => {
    if (selectedTickers.length < MIN_SELECTIONS) return

    let cancelled = false
    setIsLoading(true)

    const fromStr = getCompareStartDate(selectedRange)
    const toStr = getTodayStr()

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          selectedTickers.map(async (ticker) => {
            const prices = await window.electronAPI.getHistoricalPrices(ticker, fromStr, toStr)
            return { ticker, prices }
          })
        )

        if (cancelled) return

        const newData: Record<string, ReadonlyArray<PricePoint>> = {}
        for (const { ticker, prices } of results) {
          newData[ticker] = prices
        }
        setPriceData(newData)
      } catch (error) {
        if (!cancelled) {
          throw new Error(
            `Failed to fetch comparison data: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [selectedTickers, selectedRange])

  const chartData = useMemo(
    () => normalizePriceSeries(priceData, selectedTickers),
    [priceData, selectedTickers]
  )

  const tickerColors = useMemo(() => {
    const colorMap: Record<string, string> = {}
    for (const ticker of selectedTickers) {
      const position = openPositions.find((p) => p.ticker === ticker)
      colorMap[ticker] = position?.color ?? getTickerColor(ticker)
    }
    return colorMap
  }, [selectedTickers, openPositions])

  const tickFormatter = useMemo(() => formatXAxis(selectedRange), [selectedRange])

  const lastValues = useMemo(() => {
    if (chartData.length === 0) return {}
    const last = chartData[chartData.length - 1]
    const result: Record<string, number> = {}
    for (const ticker of selectedTickers) {
      const val = last[ticker]
      if (typeof val === 'number') {
        result[ticker] = val
      }
    }
    return result
  }, [chartData, selectedTickers])

  if (openPositions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-sv-text-muted">Add positions to compare stocks</span>
      </div>
    )
  }

  if (openPositions.length < MIN_SELECTIONS) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-sv-text-muted">Add more positions to compare</span>
      </div>
    )
  }

  const atMaxSelection = selectedTickers.length >= MAX_SELECTIONS
  const hasEnoughSelected = selectedTickers.length >= MIN_SELECTIONS

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-sv-text">Compare Stocks</h2>
        <div className="flex gap-1">
          {COMPARE_RANGES.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedRange(option.value)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
                selectedRange === option.value
                  ? 'bg-sv-accent text-white'
                  : 'bg-transparent text-sv-text-secondary hover:bg-sv-elevated'
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {openPositions.map((position) => {
          const color = position.color || getTickerColor(position.ticker)
          const isSelected = selectedTickers.includes(position.ticker)
          return (
            <TickerPill
              key={position.ticker}
              ticker={position.ticker}
              color={color}
              selected={isSelected}
              disabled={atMaxSelection && !isSelected}
              onToggle={handleToggle}
            />
          )
        })}
      </div>

      {!hasEnoughSelected && (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-sv-text-muted">Select 2-4 stocks to compare</span>
        </div>
      )}

      {hasEnoughSelected && isLoading && chartData.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-sv-text-muted">Loading comparison data...</span>
        </div>
      )}

      {hasEnoughSelected && chartData.length > 0 && (
        <>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData as Record<string, unknown>[]}
                margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              >
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
                  tickFormatter={formatYAxis}
                  stroke="#6B7280"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  width={70}
                />
                <Tooltip content={<CompareTooltipContent />} cursor={{ stroke: '#3B82F6', strokeOpacity: 0.3 }} />
                {selectedTickers.map((ticker) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={tickerColors[ticker]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: tickerColors[ticker], stroke: '#0A0E17', strokeWidth: 2 }}
                    animationDuration={300}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-4">
            {selectedTickers.map((ticker) => (
              <LegendEntry
                key={ticker}
                ticker={ticker}
                color={tickerColors[ticker]}
                currentValue={lastValues[ticker]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
