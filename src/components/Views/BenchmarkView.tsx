import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ComposedChart
} from 'recharts'
import { useBenchmarkStore, DEFAULT_BENCHMARKS } from '../../stores/benchmarkStore'
import type { BenchmarkTimeRange } from '../../types/index'
import {
  BENCHMARK_RANGES,
  mergeChartData,
  formatXAxisTick,
  formatYAxisTick,
  formatReturnValue,
  formatDrawdownValue
} from './benchmarkUtils'

// ─── Constants ────────────────────────────────────────────────────────────────

const PORTFOLIO_COLOR = '#3B82F6' // sv-accent
const BENCHMARK_COLOR = '#F59E0B' // amber

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  readonly label: string
  readonly value: string
  readonly colorClass: string
  readonly subtitle?: string
}

function StatCard({ label, value, colorClass, subtitle }: StatCardProps) {
  return (
    <div className="rounded-lg bg-sv-surface border border-sv-border p-4">
      <p className="text-xs text-sv-text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-xl font-mono tabular-nums font-semibold ${colorClass}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-sv-text-muted mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

function getReturnColorClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

interface BenchmarkSelectorProps {
  readonly selectedTicker: string
  readonly customTicker: string
  readonly onSelectPreset: (ticker: string) => void
  readonly onCustomTickerChange: (value: string) => void
  readonly onCustomTickerSubmit: () => void
}

function BenchmarkSelector({
  selectedTicker,
  customTicker,
  onSelectPreset,
  onCustomTickerChange,
  onCustomTickerSubmit
}: BenchmarkSelectorProps) {
  const isPreset = DEFAULT_BENCHMARKS.some((b) => b.ticker === selectedTicker)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {DEFAULT_BENCHMARKS.map((b) => (
        <button
          key={b.ticker}
          onClick={() => onSelectPreset(b.ticker)}
          className={[
            'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 border cursor-pointer',
            selectedTicker === b.ticker
              ? 'border-amber-500 bg-amber-500/20 text-amber-400'
              : 'border-sv-border text-sv-text-secondary hover:bg-sv-elevated'
          ].join(' ')}
        >
          {b.ticker}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={customTicker}
          onChange={(e) => onCustomTickerChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCustomTickerSubmit()
          }}
          placeholder="Custom..."
          className={[
            'w-24 rounded-full border px-3 py-1 text-xs font-medium bg-sv-bg text-sv-text',
            'placeholder:text-sv-text-muted focus:outline-none focus:ring-1 focus:ring-sv-accent',
            !isPreset ? 'border-amber-500' : 'border-sv-border'
          ].join(' ')}
          maxLength={10}
        />
        {customTicker.length > 0 && (
          <button
            onClick={onCustomTickerSubmit}
            className="rounded-full px-2 py-1 text-xs font-medium bg-sv-accent text-white hover:bg-sv-accent/80 transition-colors cursor-pointer"
          >
            Go
          </button>
        )}
      </div>
    </div>
  )
}

interface TimeRangeToggleProps {
  readonly selected: BenchmarkTimeRange
  readonly onChange: (range: BenchmarkTimeRange) => void
}

function TimeRangeToggle({ selected, onChange }: TimeRangeToggleProps) {
  return (
    <div className="flex gap-1">
      {BENCHMARK_RANGES.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={[
            'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer',
            selected === option.value
              ? 'bg-sv-accent text-white'
              : 'bg-transparent text-sv-text-secondary hover:bg-sv-elevated'
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface BenchmarkTooltipProps {
  readonly active?: boolean
  readonly payload?: ReadonlyArray<{
    readonly dataKey: string
    readonly value: number
    readonly color: string
  }>
  readonly label?: string
}

function BenchmarkTooltip({ active, payload, label }: BenchmarkTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-sv-border bg-sv-elevated p-3 shadow-lg">
      <p className="mb-2 text-xs text-sv-text-muted">{label}</p>
      {payload
        .filter((entry) => entry.dataKey !== 'spread')
        .map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sv-text-secondary">
              {entry.dataKey === 'portfolio' ? 'Portfolio' : 'Benchmark'}
            </span>
            <span
              className={[
                'ml-auto font-mono tabular-nums',
                entry.value >= 0 ? 'text-sv-positive' : 'text-sv-negative'
              ].join(' ')}
            >
              {entry.value >= 0 ? '+' : ''}
              {entry.value.toFixed(2)}%
            </span>
          </div>
        ))}
      {payload.length >= 2 && (
        <div className="flex items-center gap-2 text-xs mt-1 pt-1 border-t border-sv-border">
          <span className="text-sv-text-muted">Alpha</span>
          <span
            className={[
              'ml-auto font-mono tabular-nums',
              (() => {
                const portfolioEntry = payload.find((e) => e.dataKey === 'portfolio')
                const benchmarkEntry = payload.find((e) => e.dataKey === 'benchmark')
                if (!portfolioEntry || !benchmarkEntry) return ''
                return portfolioEntry.value - benchmarkEntry.value >= 0
                  ? 'text-sv-positive'
                  : 'text-sv-negative'
              })()
            ].join(' ')}
          >
            {(() => {
              const portfolioEntry = payload.find((e) => e.dataKey === 'portfolio')
              const benchmarkEntry = payload.find((e) => e.dataKey === 'benchmark')
              if (!portfolioEntry || !benchmarkEntry) return '—'
              const diff = portfolioEntry.value - benchmarkEntry.value
              return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`
            })()}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BenchmarkView() {
  const benchmarkTicker = useBenchmarkStore((s) => s.benchmarkTicker)
  const timeRange = useBenchmarkStore((s) => s.timeRange)
  const portfolioTWR = useBenchmarkStore((s) => s.portfolioTWR)
  const benchmarkTWR = useBenchmarkStore((s) => s.benchmarkTWR)
  const stats = useBenchmarkStore((s) => s.stats)
  const isLoading = useBenchmarkStore((s) => s.isLoading)
  const error = useBenchmarkStore((s) => s.error)
  const setBenchmarkTicker = useBenchmarkStore((s) => s.setBenchmarkTicker)
  const setTimeRange = useBenchmarkStore((s) => s.setTimeRange)
  const fetchBenchmarkData = useBenchmarkStore((s) => s.fetchBenchmarkData)

  const [customTicker, setCustomTicker] = useState('')

  const handleSelectPreset = useCallback(
    (ticker: string) => {
      setBenchmarkTicker(ticker)
      setCustomTicker('')
    },
    [setBenchmarkTicker]
  )

  const handleCustomTickerSubmit = useCallback(() => {
    const trimmed = customTicker.trim().toUpperCase()
    if (trimmed.length > 0 && trimmed.length <= 10) {
      setBenchmarkTicker(trimmed)
    }
  }, [customTicker, setBenchmarkTicker])

  const handleTimeRangeChange = useCallback(
    (range: BenchmarkTimeRange) => {
      setTimeRange(range)
    },
    [setTimeRange]
  )

  // Fetch data when benchmark ticker or time range changes
  useEffect(() => {
    fetchBenchmarkData().catch(() => {
      // Error is set in the store
    })
  }, [benchmarkTicker, timeRange, fetchBenchmarkData])

  const chartData = useMemo(
    () => mergeChartData(portfolioTWR, benchmarkTWR),
    [portfolioTWR, benchmarkTWR]
  )

  const xAxisFormatter = useMemo(() => formatXAxisTick(timeRange), [timeRange])

  const benchmarkLabel = useMemo(() => {
    const preset = DEFAULT_BENCHMARKS.find((b) => b.ticker === benchmarkTicker)
    return preset ? preset.label : benchmarkTicker
  }, [benchmarkTicker])

  // Empty state
  if (!isLoading && portfolioTWR.length === 0 && !error) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-sv-text">Portfolio Benchmark</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-sv-text-muted">
              Add transactions to see your portfolio performance against a benchmark.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-sv-text">Portfolio Benchmark</h2>
        <TimeRangeToggle selected={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {/* Benchmark Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <BenchmarkSelector
          selectedTicker={benchmarkTicker}
          customTicker={customTicker}
          onSelectPreset={handleSelectPreset}
          onCustomTickerChange={setCustomTicker}
          onCustomTickerSubmit={handleCustomTickerSubmit}
        />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PORTFOLIO_COLOR }}
            />
            <span className="text-xs text-sv-text-secondary">Portfolio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BENCHMARK_COLOR }}
            />
            <span className="text-xs text-sv-text-secondary">{benchmarkLabel}</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-sv-negative/30 bg-sv-negative/10 p-3">
          <p className="text-xs text-sv-negative">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && chartData.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-sv-text-muted">Loading benchmark data...</span>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="min-h-0 flex-1" style={{ minHeight: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
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
                tickFormatter={xAxisFormatter}
                stroke="#6B7280"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                orientation="right"
                tickFormatter={formatYAxisTick}
                stroke="#6B7280"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                width={70}
              />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
              <Tooltip
                content={<BenchmarkTooltip />}
                cursor={{ stroke: '#3B82F6', strokeOpacity: 0.3 }}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke={PORTFOLIO_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: PORTFOLIO_COLOR,
                  stroke: '#0A0E17',
                  strokeWidth: 2
                }}
                animationDuration={300}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={BENCHMARK_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: BENCHMARK_COLOR,
                  stroke: '#0A0E17',
                  strokeWidth: 2
                }}
                animationDuration={300}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats Panel */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard
            label="Portfolio Return"
            value={formatReturnValue(stats.portfolioReturn)}
            colorClass={getReturnColorClass(stats.portfolioReturn)}
            subtitle={
              stats.portfolioAnnualizedReturn !== stats.portfolioReturn
                ? `${formatReturnValue(stats.portfolioAnnualizedReturn)} ann.`
                : undefined
            }
          />
          <StatCard
            label={`${benchmarkTicker} Return`}
            value={formatReturnValue(stats.benchmarkReturn)}
            colorClass={getReturnColorClass(stats.benchmarkReturn)}
            subtitle={
              stats.benchmarkAnnualizedReturn !== stats.benchmarkReturn
                ? `${formatReturnValue(stats.benchmarkAnnualizedReturn)} ann.`
                : undefined
            }
          />
          <StatCard
            label="Alpha (Excess)"
            value={formatReturnValue(stats.alpha)}
            colorClass={getReturnColorClass(stats.alpha)}
          />
          <StatCard
            label="Tracking Diff."
            value={formatReturnValue(stats.trackingDifference)}
            colorClass={getReturnColorClass(stats.trackingDifference)}
            subtitle="Annualized"
          />
          <StatCard
            label="Portfolio Max DD"
            value={formatDrawdownValue(stats.portfolioMaxDrawdown)}
            colorClass={stats.portfolioMaxDrawdown > 0 ? 'text-sv-negative' : 'text-sv-text'}
          />
          <StatCard
            label={`${benchmarkTicker} Max DD`}
            value={formatDrawdownValue(stats.benchmarkMaxDrawdown)}
            colorClass={stats.benchmarkMaxDrawdown > 0 ? 'text-sv-negative' : 'text-sv-text'}
          />
        </div>
      )}
    </div>
  )
}
