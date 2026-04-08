import { useState, useEffect } from 'react'
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
import type { PricePoint } from '../../types/index'

interface WatchlistSparklineProps {
  readonly ticker: string
  readonly dayChange: number
}

interface SparklinePoint {
  readonly date: string
  readonly close: number
}

function toSparklineData(prices: ReadonlyArray<PricePoint>): ReadonlyArray<SparklinePoint> {
  return prices.map((p) => ({ date: p.date, close: p.close }))
}

function getSparklineStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 10)
  return date.toISOString().split('T')[0] ?? ''
}

function getToday(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

export function WatchlistSparkline({ ticker, dayChange }: WatchlistSparklineProps) {
  const [data, setData] = useState<ReadonlyArray<SparklinePoint>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const fetchData = async () => {
      try {
        const from = getSparklineStartDate()
        const to = getToday()
        const prices = await window.electronAPI.getHistoricalPrices(ticker, from, to)
        if (!cancelled) setData(toSparklineData(prices))
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [ticker])

  if (isLoading) {
    return (
      <div className="w-[80px] h-[32px] flex items-center justify-center">
        <div className="w-full h-[1px] bg-sv-border" />
      </div>
    )
  }

  if (data.length < 2) {
    return (
      <div className="w-[80px] h-[32px] flex items-center justify-center">
        <span className="text-[10px] text-sv-text-muted">No data</span>
      </div>
    )
  }

  const strokeColor = dayChange >= 0 ? 'var(--color-sv-positive)' : 'var(--color-sv-negative)'
  const closes = data.map((d) => d.close)
  const minVal = Math.min(...closes)
  const maxVal = Math.max(...closes)
  const padding = (maxVal - minVal) * 0.1 || 1

  return (
    <div className="w-[80px] h-[32px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]}>
          <YAxis domain={[minVal - padding, maxVal + padding]} hide />
          <Line
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
