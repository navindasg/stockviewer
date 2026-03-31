import YahooFinanceModule from 'yahoo-finance2'

// electron-vite compiles ESM default import to CJS require(), which wraps
// the class in { default: YahooFinance }. Handle both cases.
const YahooFinance = ('default' in YahooFinanceModule
  ? (YahooFinanceModule as Record<string, unknown>).default
  : YahooFinanceModule) as new () => typeof YahooFinanceModule
import { format } from 'date-fns'
import {
  getCachedPrices,
  getLatestCachedDate,
  upsertPrices,
  upsertTickerMetadata,
  getTickerMetadata
} from './db/priceCache'
import { getTickerColor } from '../src/utils/colors'
import type { Quote, PricePoint, SearchResult } from '../src/types/index'

const STALE_THRESHOLD = 15 * 60 * 1000
const RATE_LIMIT_DELAY = 200
const RETRY_DELAYS: ReadonlyArray<number> = [1000, 2000, 4000]

interface CacheEntry {
  readonly quote: Quote
  readonly fetchedAt: number
}

const quoteCache = new Map<string, CacheEntry>()
const yahooFinance = new YahooFinance()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function buildQuoteFromCachedMetadata(
  ticker: string
): Quote | null {
  const meta = getTickerMetadata(ticker)
  if (!meta) {
    return null
  }

  return {
    ticker,
    price: 0,
    previousClose: 0,
    dayChange: 0,
    dayChangePercent: 0,
    companyName: meta.company_name ?? ticker,
    sector: meta.sector ?? null,
    marketCap: null,
    offline: true
  }
}

export async function getQuote(ticker: string): Promise<Quote> {
  const upperTicker = ticker.toUpperCase()

  try {
    const result = await yahooFinance.quote(upperTicker)

    const quote: Quote = {
      ticker: upperTicker,
      price: result.regularMarketPrice ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      dayChange: result.regularMarketChange ?? 0,
      dayChangePercent: result.regularMarketChangePercent ?? 0,
      companyName: result.longName ?? result.shortName ?? upperTicker,
      sector: null,
      marketCap: result.marketCap ?? null,
      isStale: false,
      offline: false
    }

    quoteCache.set(upperTicker, {
      quote,
      fetchedAt: Date.now()
    })

    upsertTickerMetadata(upperTicker, {
      companyName: quote.companyName,
      color: getTickerColor(upperTicker)
    })

    fetchSectorAsync(upperTicker)

    return quote
  } catch (error) {
    const cached = buildQuoteFromCachedMetadata(upperTicker)
    if (cached) {
      return cached
    }
    throw new Error(
      `Failed to fetch quote for ${upperTicker}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function fetchSectorAsync(ticker: string): void {
  yahooFinance
    .quoteSummary(ticker, { modules: ['summaryProfile'] })
    .then((summary) => {
      const sector = summary.summaryProfile?.sector ?? null
      const industry = summary.summaryProfile?.industry ?? null
      if (sector || industry) {
        upsertTickerMetadata(ticker, { sector: sector ?? undefined, industry: industry ?? undefined })

        const existing = quoteCache.get(ticker)
        if (existing) {
          quoteCache.set(ticker, {
            ...existing,
            quote: { ...existing.quote, sector }
          })
        }
      }
    })
    .catch(() => {
      // Sector fetch is best-effort; failures are non-critical
    })
}

export async function getQuotes(
  tickers: ReadonlyArray<string>
): Promise<ReadonlyArray<Quote>> {
  const results: Quote[] = []

  for (let i = 0; i < tickers.length; i++) {
    if (i > 0) {
      await sleep(RATE_LIMIT_DELAY)
    }
    const quote = await getQuote(tickers[i])
    results.push(quote)
  }

  return results
}

export async function getHistoricalPrices(
  ticker: string,
  from: string,
  to: string
): Promise<ReadonlyArray<PricePoint>> {
  const upperTicker = ticker.toUpperCase()

  const cachedPrices = getCachedPrices(upperTicker, from, to)
  const latestCached = getLatestCachedDate(upperTicker)

  const needsFetch = !latestCached || latestCached < to

  if (!needsFetch) {
    return cachedPrices
  }

  const fetchFrom = latestCached
    ? nextDay(latestCached)
    : from

  if (fetchFrom > to) {
    return cachedPrices
  }

  try {
    const freshPrices = await fetchHistoricalWithRetry(
      upperTicker,
      fetchFrom,
      to
    )

    if (freshPrices.length > 0) {
      upsertPrices(upperTicker, freshPrices)
    }

    return getCachedPrices(upperTicker, from, to)
  } catch {
    return cachedPrices
  }
}

async function fetchHistoricalWithRetry(
  ticker: string,
  from: string,
  to: string
): Promise<ReadonlyArray<PricePoint>> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fetchHistoricalOnce(ticker, from, to)
    } catch (error) {
      lastError = error
      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt])
      }
    }
  }

  throw lastError
}

async function fetchHistoricalOnce(
  ticker: string,
  from: string,
  to: string
): Promise<ReadonlyArray<PricePoint>> {
  const rows = await yahooFinance.historical(ticker, {
    period1: from,
    period2: to,
    interval: '1d'
  })

  return rows.map((row) => ({
    date: formatDate(row.date),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume
  }))
}

function nextDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + 1)
  return formatDate(date)
}

export async function searchTicker(
  query: string
): Promise<ReadonlyArray<SearchResult>> {
  try {
    const result = await yahooFinance.search(query, {
      quotesCount: 10,
      newsCount: 0
    })

    return result.quotes
      .filter(
        (q): q is typeof q & { isYahooFinance: true } =>
          q.isYahooFinance === true
      )
      .filter((q) => {
        const quoteType = 'quoteType' in q ? q.quoteType : ''
        return quoteType === 'EQUITY' || quoteType === 'ETF'
      })
      .map((q) => ({
        ticker: q.symbol,
        name: ('longname' in q && q.longname)
          ? String(q.longname)
          : ('shortname' in q && q.shortname)
            ? String(q.shortname)
            : q.symbol,
        exchange: q.exchange,
        type: 'quoteType' in q ? String(q.quoteType) : 'EQUITY'
      }))
  } catch (error) {
    throw new Error(
      `Search failed for "${query}": ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function isQuoteStale(ticker: string): boolean {
  const entry = quoteCache.get(ticker.toUpperCase())
  if (!entry) {
    return true
  }
  return Date.now() - entry.fetchedAt > STALE_THRESHOLD
}

export function getCachedQuote(ticker: string): Quote | null {
  const entry = quoteCache.get(ticker.toUpperCase())
  return entry?.quote ?? null
}
