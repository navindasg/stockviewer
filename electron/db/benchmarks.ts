import type { TWRDataPoint, BenchmarkStats, Transaction, PricePoint } from '../../src/types/index'
import { getDatabase } from './database'
import { getCachedPrices } from './priceCache'

// ─── Internal types ──────────────────────────────────────────────────────────

interface CashFlowEvent {
  readonly date: string
  readonly amount: number // positive = inflow (BUY), negative = outflow (SELL proceeds)
}

interface DailyHolding {
  readonly ticker: string
  readonly shares: number
}

interface DividendRow {
  readonly ticker: string
  readonly pay_date: string
  readonly total_amount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllEquityTransactions(portfolioId?: number): ReadonlyArray<Transaction> {
  const db = getDatabase()

  let query = "SELECT * FROM transactions WHERE asset_type = 'EQUITY'"
  const params: unknown[] = []

  if (portfolioId !== undefined) {
    query += ' AND portfolio_id = ?'
    params.push(portfolioId)
  }

  query += ' ORDER BY date ASC, created_at ASC'
  return db.prepare(query).all(...params) as Transaction[]
}

function getAllDividends(from: string, to: string, portfolioId?: number): ReadonlyArray<DividendRow> {
  const db = getDatabase()

  let query = 'SELECT ticker, pay_date, total_amount FROM dividends WHERE pay_date >= ? AND pay_date <= ?'
  const params: unknown[] = [from, to]

  if (portfolioId !== undefined) {
    query += ' AND portfolio_id = ?'
    params.push(portfolioId)
  }

  query += ' ORDER BY pay_date ASC'
  return db.prepare(query).all(...params) as DividendRow[]
}

function generateDateRange(from: string, to: string): ReadonlyArray<string> {
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Build a map of ticker → (date → close price) from the price_cache table.
 * Only fetches data within the requested date range.
 */
function buildPriceMap(
  tickers: ReadonlyArray<string>,
  from: string,
  to: string
): ReadonlyMap<string, ReadonlyMap<string, number>> {
  const result = new Map<string, Map<string, number>>()

  for (const ticker of tickers) {
    const prices = getCachedPrices(ticker, from, to)
    const map = new Map<string, number>()

    for (const p of prices) {
      map.set(p.date.slice(0, 10), p.close)
    }

    result.set(ticker, map)
  }

  return result
}

/**
 * Walk through transactions chronologically to compute what shares are held
 * on each date. Returns a map: date → array of { ticker, shares }.
 *
 * We only track holdings changes on cash-flow dates, then carry forward.
 */
function buildHoldingsTimeline(
  transactions: ReadonlyArray<Transaction>,
  dates: ReadonlyArray<string>
): ReadonlyMap<string, ReadonlyArray<DailyHolding>> {
  // Aggregate transactions by date
  const txByDate = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const d = tx.date.slice(0, 10)
    const existing = txByDate.get(d)
    if (existing) {
      existing.push(tx)
    } else {
      txByDate.set(d, [tx])
    }
  }

  // Running tally of shares per ticker
  const sharesHeld = new Map<string, number>()
  const timeline = new Map<string, ReadonlyArray<DailyHolding>>()

  for (const date of dates) {
    const dayTxs = txByDate.get(date)
    if (dayTxs) {
      for (const tx of dayTxs) {
        const current = sharesHeld.get(tx.ticker) ?? 0
        if (tx.type === 'BUY') {
          sharesHeld.set(tx.ticker, current + tx.shares)
        } else {
          sharesHeld.set(tx.ticker, Math.max(0, current - tx.shares))
        }
      }
    }

    // Snapshot current holdings
    const holdings: DailyHolding[] = []
    for (const [ticker, shares] of sharesHeld) {
      if (shares > 0) {
        holdings.push({ ticker, shares })
      }
    }
    timeline.set(date, holdings)
  }

  return timeline
}

/**
 * Compute the market value of holdings on a given date using the price map.
 * If a price is missing for a date, carry forward the last known price.
 */
function computePortfolioValue(
  holdings: ReadonlyArray<DailyHolding>,
  priceMap: ReadonlyMap<string, ReadonlyMap<string, number>>,
  date: string,
  lastKnownPrices: Map<string, number>
): number {
  let value = 0

  for (const holding of holdings) {
    const tickerPrices = priceMap.get(holding.ticker)
    const price = tickerPrices?.get(date) ?? lastKnownPrices.get(holding.ticker) ?? 0

    if (tickerPrices?.has(date)) {
      lastKnownPrices.set(holding.ticker, price)
    }

    value += holding.shares * price
  }

  return value
}

/**
 * Build cash flow events from transactions and dividends.
 * BUY = positive cash flow INTO portfolio (investment)
 * SELL = negative cash flow OUT of portfolio (withdrawal of proceeds)
 * DIVIDEND (CASH) = negative cash flow (income withdrawn)
 */
function buildCashFlows(
  transactions: ReadonlyArray<Transaction>,
  dividends: ReadonlyArray<DividendRow>
): ReadonlyMap<string, number> {
  const flows = new Map<string, number>()

  for (const tx of transactions) {
    const date = tx.date.slice(0, 10)
    const current = flows.get(date) ?? 0
    if (tx.type === 'BUY') {
      // Money flowing in: cost + fees
      flows.set(date, current + (tx.shares * tx.price) + tx.fees)
    } else {
      // Money flowing out: net proceeds after fees.
      // Formula: -(shares * price) + fees means fees reduce the withdrawal amount,
      // which is correct because fees are borne by the portfolio (reducing what leaves).
      flows.set(date, current - (tx.shares * tx.price) + tx.fees)
    }
  }

  for (const div of dividends) {
    if (div.total_amount > 0) {
      const date = div.pay_date.slice(0, 10)
      const current = flows.get(date) ?? 0
      // Cash dividend is income withdrawn from the portfolio
      flows.set(date, current - div.total_amount)
    }
  }

  return flows
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute time-weighted return (TWR) series for the portfolio.
 *
 * TWR methodology:
 * 1. Identify all cash flow events (buys, sells, dividends)
 * 2. Compute portfolio value at start and end of each sub-period
 * 3. Sub-period return = (V_end) / (V_start + CF) - 1
 *    where CF is the net cash flow on the start date
 * 4. Cumulative TWR = geometric linking: product(1 + r_i) - 1
 *
 * Returns daily cumulative return series rebased to 0% at the start.
 */
export function computePortfolioTWR(from: string, to: string, portfolioId?: number): ReadonlyArray<TWRDataPoint> {
  const allTransactions = getAllEquityTransactions(portfolioId)

  if (allTransactions.length === 0) {
    return []
  }

  // Determine the effective start: latest of `from` or first transaction date
  const firstTxDate = allTransactions[0].date.slice(0, 10)
  const effectiveFrom = from < firstTxDate ? firstTxDate : from

  if (effectiveFrom > to) {
    return []
  }

  // Filter transactions within range (include all prior for holdings state)
  const priorTransactions = allTransactions.filter((tx) => tx.date.slice(0, 10) < effectiveFrom)
  const rangeTransactions = allTransactions.filter(
    (tx) => tx.date.slice(0, 10) >= effectiveFrom && tx.date.slice(0, 10) <= to
  )

  const dividends = getAllDividends(effectiveFrom, to, portfolioId)
  const dates = generateDateRange(effectiveFrom, to)

  if (dates.length === 0) {
    return []
  }

  // Collect all tickers that were ever held in or before the range
  const allTickers = new Set<string>()
  for (const tx of allTransactions) {
    if (tx.date.slice(0, 10) <= to) {
      allTickers.add(tx.ticker)
    }
  }

  const priceMap = buildPriceMap([...allTickers], effectiveFrom, to)

  // Build holdings timeline including prior transactions for initial state
  const allRelevantTxs = [...priorTransactions, ...rangeTransactions]
  const holdingsTimeline = buildHoldingsTimeline(allRelevantTxs, dates)

  // Build cash flows for the range only
  const cashFlows = buildCashFlows(rangeTransactions, dividends)

  // Compute TWR using modified Dietz sub-period approach
  const lastKnownPrices = new Map<string, number>()

  // Seed last known prices from prior data if we have holdings at start
  if (priorTransactions.length > 0) {
    for (const ticker of allTickers) {
      const tickerPrices = priceMap.get(ticker)
      if (tickerPrices) {
        // Find the earliest price in our range as seed
        for (const date of dates) {
          const price = tickerPrices.get(date)
          if (price !== undefined) {
            lastKnownPrices.set(ticker, price)
            break
          }
        }
      }
    }
  }

  const result: TWRDataPoint[] = []
  let cumulativeTWR = 1.0
  let previousValue: number | null = null

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    const holdings = holdingsTimeline.get(date) ?? []
    const currentValue = computePortfolioValue(holdings, priceMap, date, lastKnownPrices)
    const cashFlow = cashFlows.get(date) ?? 0

    if (i === 0) {
      // First day: establish the base value
      previousValue = currentValue
      result.push({ date, cumulativeReturn: 0 })
      continue
    }

    if (previousValue !== null && previousValue + cashFlow > 0) {
      // Sub-period return: how did the portfolio value change,
      // adjusted for any cash flow that happened today?
      // Cash flow is added to the denominator because it happened at start of day
      const subPeriodReturn = currentValue / (previousValue + cashFlow) - 1
      cumulativeTWR *= (1 + subPeriodReturn)
    } else if (previousValue === 0 && currentValue > 0 && cashFlow > 0) {
      // Portfolio started from zero — first investment
      // No return to compute, just establish the new base
      cumulativeTWR = 1.0
    }

    result.push({
      date,
      cumulativeReturn: (cumulativeTWR - 1) * 100
    })

    previousValue = currentValue
  }

  return result
}

/**
 * Compute benchmark TWR series — simple price return rebased to 0%.
 * Uses cached historical prices from the price_cache table.
 */
export function computeBenchmarkTWR(
  ticker: string,
  from: string,
  to: string
): ReadonlyArray<TWRDataPoint> {
  const prices = getCachedPrices(ticker.toUpperCase(), from, to)

  if (prices.length === 0) {
    return []
  }

  const startPrice = prices[0].close

  return prices.map((p) => ({
    date: p.date.slice(0, 10),
    cumulativeReturn: ((p.close - startPrice) / startPrice) * 100
  }))
}

/**
 * Compute comparison statistics between portfolio and benchmark.
 */
export function computeBenchmarkStats(
  portfolioTWR: ReadonlyArray<TWRDataPoint>,
  benchmarkTWR: ReadonlyArray<TWRDataPoint>,
  from: string,
  to: string
): BenchmarkStats {
  const portfolioReturn = portfolioTWR.length > 0
    ? portfolioTWR[portfolioTWR.length - 1].cumulativeReturn
    : 0

  const benchmarkReturn = benchmarkTWR.length > 0
    ? benchmarkTWR[benchmarkTWR.length - 1].cumulativeReturn
    : 0

  const alpha = portfolioReturn - benchmarkReturn

  const portfolioMaxDrawdown = computeMaxDrawdown(portfolioTWR)
  const benchmarkMaxDrawdown = computeMaxDrawdown(benchmarkTWR)

  // Annualize returns
  const startDate = new Date(from)
  const endDate = new Date(to)
  const daysDiff = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const yearFraction = daysDiff / 365.25

  const portfolioBase = 1 + portfolioReturn / 100
  const portfolioAnnualizedReturn = yearFraction >= 1 && portfolioBase > 0
    ? (Math.pow(portfolioBase, 1 / yearFraction) - 1) * 100
    : portfolioReturn

  const benchmarkBase = 1 + benchmarkReturn / 100
  const benchmarkAnnualizedReturn = yearFraction >= 1 && benchmarkBase > 0
    ? (Math.pow(benchmarkBase, 1 / yearFraction) - 1) * 100
    : benchmarkReturn

  const trackingDifference = portfolioAnnualizedReturn - benchmarkAnnualizedReturn

  return {
    portfolioReturn,
    benchmarkReturn,
    alpha,
    portfolioMaxDrawdown,
    benchmarkMaxDrawdown,
    trackingDifference,
    portfolioAnnualizedReturn,
    benchmarkAnnualizedReturn
  }
}

/**
 * Compute max drawdown from a cumulative return series.
 * Drawdown = peak-to-trough decline as a percentage.
 */
function computeMaxDrawdown(series: ReadonlyArray<TWRDataPoint>): number {
  if (series.length < 2) {
    return 0
  }

  let maxDrawdown = 0
  let peak = 100 + series[0].cumulativeReturn // Convert to value basis (100 = starting value)

  for (let i = 1; i < series.length; i++) {
    const current = 100 + series[i].cumulativeReturn
    if (current > peak) {
      peak = current
    }
    const drawdown = peak > 0 ? ((peak - current) / peak) * 100 : 0
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return maxDrawdown
}
