import { randomUUID } from 'crypto'
import type { Transaction, NewTransaction, TransactionFilters, Position } from '../../src/types/index'
import { getDatabase } from './database'

export function addTransaction(tx: NewTransaction): Transaction {
  const db = getDatabase()
  const id = randomUUID()
  const now = new Date().toISOString()
  const fees = tx.fees ?? 0
  const notes = tx.notes ?? null

  if (tx.type === 'SELL') {
    validateSell(tx.ticker, tx.shares, tx.date)
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (id, ticker, type, shares, price, date, fees, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, tx.ticker.toUpperCase(), tx.type, tx.shares, tx.price, tx.date, fees, notes, now, now)

  return {
    id,
    ticker: tx.ticker.toUpperCase(),
    type: tx.type,
    shares: tx.shares,
    price: tx.price,
    date: tx.date,
    fees,
    notes,
    created_at: now,
    updated_at: now
  }
}

export function updateTransaction(id: string, updates: Partial<NewTransaction>): Transaction {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined
  if (!existing) {
    throw new Error(`Transaction ${id} not found`)
  }

  const merged = {
    ticker: updates.ticker?.toUpperCase() ?? existing.ticker,
    type: updates.type ?? existing.type,
    shares: updates.shares ?? existing.shares,
    price: updates.price ?? existing.price,
    date: updates.date ?? existing.date,
    fees: updates.fees ?? existing.fees,
    notes: updates.notes !== undefined ? (updates.notes ?? null) : existing.notes
  }

  if (merged.type === 'SELL') {
    validateSell(merged.ticker, merged.shares, merged.date, id)
  }

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE transactions
    SET ticker = ?, type = ?, shares = ?, price = ?, date = ?, fees = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(merged.ticker, merged.type, merged.shares, merged.price, merged.date, merged.fees, merged.notes, now, id)

  return {
    id,
    ticker: merged.ticker,
    type: merged.type,
    shares: merged.shares,
    price: merged.price,
    date: merged.date,
    fees: merged.fees,
    notes: merged.notes,
    created_at: existing.created_at,
    updated_at: now
  }
}

export function deleteTransaction(id: string): void {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  if (result.changes === 0) {
    throw new Error(`Transaction ${id} not found`)
  }
}

export function getTransactions(filters?: TransactionFilters): ReadonlyArray<Transaction> {
  const db = getDatabase()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.ticker) {
    conditions.push('ticker = ?')
    params.push(filters.ticker.toUpperCase())
  }
  if (filters?.type) {
    conditions.push('type = ?')
    params.push(filters.type)
  }
  if (filters?.fromDate) {
    conditions.push('date >= ?')
    params.push(filters.fromDate)
  }
  if (filters?.toDate) {
    conditions.push('date <= ?')
    params.push(filters.toDate)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM transactions ${where} ORDER BY date ASC, created_at ASC`).all(...params)

  return rows as Transaction[]
}

export function getPositions(): ReadonlyArray<Position> {
  const db = getDatabase()
  const tickers = db.prepare('SELECT DISTINCT ticker FROM transactions ORDER BY ticker').all() as Array<{ ticker: string }>

  return tickers.map((row) => computePosition(row.ticker))
}

function computePosition(ticker: string): Position {
  const db = getDatabase()
  const transactions = db.prepare(
    'SELECT * FROM transactions WHERE ticker = ? ORDER BY date ASC, created_at ASC'
  ).all(ticker) as Transaction[]

  let totalBuyShares = 0
  let totalBuyCost = 0
  let totalRealized = 0

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      totalBuyCost += tx.shares * tx.price
      totalBuyShares += tx.shares
    } else {
      const avgCost = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0
      totalRealized += (tx.price - avgCost) * tx.shares
      totalBuyCost -= avgCost * tx.shares
      totalBuyShares -= tx.shares
    }
  }

  const costBasis = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0
  const totalInvested = transactions
    .filter((tx) => tx.type === 'BUY')
    .reduce((sum, tx) => sum + tx.shares * tx.price, 0)

  const metadata = db.prepare('SELECT company_name, color FROM ticker_metadata WHERE ticker = ?').get(ticker) as
    | { company_name: string | null; color: string | null }
    | undefined

  return {
    ticker,
    companyName: metadata?.company_name ?? ticker,
    totalShares: totalBuyShares,
    costBasis,
    totalInvested,
    totalRealized,
    status: totalBuyShares > 0 ? 'OPEN' : 'CLOSED',
    color: metadata?.color ?? '#3B82F6'
  }
}

function validateSell(ticker: string, sharesToSell: number, sellDate: string, excludeId?: string): void {
  const db = getDatabase()

  let query = `
    SELECT type, shares FROM transactions
    WHERE ticker = ? AND date <= ?
  `
  const params: unknown[] = [ticker.toUpperCase(), sellDate]

  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }

  query += ' ORDER BY date ASC, created_at ASC'

  const transactions = db.prepare(query).all(...params) as Array<{ type: string; shares: number }>

  let heldShares = 0
  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      heldShares += tx.shares
    } else {
      heldShares -= tx.shares
    }
  }

  if (sharesToSell > heldShares) {
    throw new Error(
      `Cannot sell ${sharesToSell} shares of ${ticker}. Only ${heldShares} shares held as of ${sellDate}.`
    )
  }
}
