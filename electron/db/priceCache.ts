import type { PricePoint } from '../../src/types/index'
import { getDatabase } from './database'

export function getCachedPrices(ticker: string, from: string, to: string): ReadonlyArray<PricePoint> {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT date, open, high, low, close, volume
    FROM price_cache
    WHERE ticker = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(ticker.toUpperCase(), from, to)

  return rows as PricePoint[]
}

export function getLatestCachedDate(ticker: string): string | null {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT MAX(date) as latest FROM price_cache WHERE ticker = ?'
  ).get(ticker.toUpperCase()) as { latest: string | null } | undefined

  return row?.latest ?? null
}

export function upsertPrices(ticker: string, prices: ReadonlyArray<PricePoint>): void {
  const db = getDatabase()
  const upperTicker = ticker.toUpperCase()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO price_cache (ticker, date, open, high, low, close, volume, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticker, date) DO UPDATE SET
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume,
      fetched_at = excluded.fetched_at
  `)

  const insertMany = db.transaction((items: ReadonlyArray<PricePoint>) => {
    for (const p of items) {
      stmt.run(upperTicker, p.date, p.open, p.high, p.low, p.close, p.volume, now)
    }
  })

  insertMany(prices)
}

export interface TickerMetadataRow {
  readonly company_name: string | null
  readonly sector: string | null
  readonly industry: string | null
  readonly color: string | null
}

export function getTickerMetadata(ticker: string): TickerMetadataRow | null {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT company_name, sector, industry, color FROM ticker_metadata WHERE ticker = ?'
  ).get(ticker.toUpperCase()) as TickerMetadataRow | undefined

  return row ?? null
}

export function upsertTickerMetadata(
  ticker: string,
  metadata: { companyName?: string; sector?: string; industry?: string; color?: string }
): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO ticker_metadata (ticker, company_name, sector, industry, color, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticker) DO UPDATE SET
      company_name = COALESCE(excluded.company_name, ticker_metadata.company_name),
      sector = COALESCE(excluded.sector, ticker_metadata.sector),
      industry = COALESCE(excluded.industry, ticker_metadata.industry),
      color = COALESCE(excluded.color, ticker_metadata.color),
      updated_at = excluded.updated_at
  `).run(
    ticker.toUpperCase(),
    metadata.companyName ?? null,
    metadata.sector ?? null,
    metadata.industry ?? null,
    metadata.color ?? null,
    now
  )
}
