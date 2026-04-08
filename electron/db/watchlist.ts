import { randomUUID } from 'crypto'
import { getDatabase } from './database'

export interface WatchlistRow {
  readonly id: string
  readonly ticker: string
  readonly company_name: string
  readonly notes: string | null
  readonly sort_order: number
  readonly added_at: string
  readonly updated_at: string
}

export function getWatchlistItems(): ReadonlyArray<WatchlistRow> {
  const db = getDatabase()
  return db.prepare('SELECT * FROM watchlist ORDER BY sort_order ASC, added_at ASC').all() as WatchlistRow[]
}

export function addWatchlistItem(
  ticker: string,
  companyName: string,
  notes?: string
): WatchlistRow {
  const db = getDatabase()
  const upperTicker = ticker.toUpperCase()

  const existing = db.prepare('SELECT id FROM watchlist WHERE ticker = ?').get(upperTicker) as
    | { id: string }
    | undefined

  if (existing) {
    throw new Error(`${upperTicker} is already on your watchlist`)
  }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM watchlist').get() as
    | { max_order: number | null }
    | undefined

  const nextOrder = (maxOrder?.max_order ?? -1) + 1
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO watchlist (id, ticker, company_name, notes, sort_order, added_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, upperTicker, companyName, notes ?? null, nextOrder, now, now)

  return {
    id,
    ticker: upperTicker,
    company_name: companyName,
    notes: notes ?? null,
    sort_order: nextOrder,
    added_at: now,
    updated_at: now
  }
}

export function removeWatchlistItem(id: string): void {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM watchlist WHERE id = ?').run(id)
  if (result.changes === 0) {
    throw new Error(`Watchlist item ${id} not found`)
  }
}

export function updateWatchlistItem(
  id: string,
  updates: { readonly notes?: string | null }
): WatchlistRow {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(id) as WatchlistRow | undefined
  if (!existing) {
    throw new Error(`Watchlist item ${id} not found`)
  }

  const now = new Date().toISOString()
  const newNotes = updates.notes !== undefined ? updates.notes : existing.notes

  db.prepare('UPDATE watchlist SET notes = ?, updated_at = ? WHERE id = ?')
    .run(newNotes, now, id)

  return {
    ...existing,
    notes: newNotes,
    updated_at: now
  }
}

export function reorderWatchlistItems(orderedIds: ReadonlyArray<string>): void {
  const db = getDatabase()

  const updateStmt = db.prepare('UPDATE watchlist SET sort_order = ?, updated_at = ? WHERE id = ?')
  const now = new Date().toISOString()

  const reorder = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      updateStmt.run(index, now, id)
    })
  })

  reorder()
}

export function watchlistItemExists(ticker: string): boolean {
  const db = getDatabase()
  const row = db.prepare('SELECT 1 FROM watchlist WHERE ticker = ?').get(ticker.toUpperCase())
  return row !== undefined
}
