import { randomUUID } from 'crypto'
import type { Transaction, NewTransaction, TransactionFilters, Position, CostBasisMethod } from '../../src/types/index'
import { getDatabase } from './database'
import {
  createTaxLot,
  assignLotsForSell,
  getCostBasisMethod,
  removeAssignmentsForTransaction,
  recomputeLotsForTicker
} from './taxLots'
import { getDefaultPortfolioId } from './portfolios'

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    ticker: row.ticker as string,
    type: row.type as Transaction['type'],
    shares: row.shares as number,
    price: row.price as number,
    date: row.date as string,
    fees: row.fees as number,
    notes: row.notes as string | null,
    portfolioId: row.portfolio_id as number | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

export function addTransaction(
  tx: NewTransaction,
  lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>
): Transaction {
  const db = getDatabase()
  const id = randomUUID()
  const now = new Date().toISOString()
  const fees = tx.fees ?? 0
  const notes = tx.notes ?? null
  const ticker = tx.ticker.toUpperCase()
  const portfolioId = tx.portfolioId ?? getDefaultPortfolioId()

  if (tx.type === 'SELL') {
    validateSell(ticker, tx.shares, tx.date, undefined, portfolioId)
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (id, ticker, type, shares, price, date, fees, notes, portfolio_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, ticker, tx.type, tx.shares, tx.price, tx.date, fees, notes, portfolioId, now, now)

  const transaction: Transaction = {
    id,
    ticker,
    type: tx.type,
    shares: tx.shares,
    price: tx.price,
    date: tx.date,
    fees,
    notes,
    portfolioId,
    created_at: now,
    updated_at: now
  }

  if (tx.type === 'BUY') {
    createTaxLot(transaction)
  } else {
    const method = getCostBasisMethod(ticker)
    assignLotsForSell(transaction, method, lotSelections)
  }

  return transaction
}

export function updateTransaction(id: string, updates: Partial<NewTransaction>): Transaction {
  const db = getDatabase()

  const existingRow = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existingRow) {
    throw new Error(`Transaction ${id} not found`)
  }
  const existing = rowToTransaction(existingRow)

  const merged = {
    ticker: updates.ticker?.toUpperCase() ?? existing.ticker,
    type: updates.type ?? existing.type,
    shares: updates.shares ?? existing.shares,
    price: updates.price ?? existing.price,
    date: updates.date ?? existing.date,
    fees: updates.fees ?? existing.fees,
    notes: updates.notes !== undefined ? (updates.notes ?? null) : existing.notes
  }

  const portfolioId = existing.portfolioId ?? undefined

  if (merged.type === 'SELL') {
    validateSell(merged.ticker, merged.shares, merged.date, id, portfolioId)
  }

  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare(`
      UPDATE transactions
      SET ticker = ?, type = ?, shares = ?, price = ?, date = ?, fees = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(merged.ticker, merged.type, merged.shares, merged.price, merged.date, merged.fees, merged.notes, now, id)

    recomputeLotsForTicker(merged.ticker, portfolioId)
    if (existing.ticker !== merged.ticker) {
      recomputeLotsForTicker(existing.ticker, portfolioId)
    }
  })()

  return {
    id,
    ticker: merged.ticker,
    type: merged.type,
    shares: merged.shares,
    price: merged.price,
    date: merged.date,
    fees: merged.fees,
    notes: merged.notes,
    portfolioId: existing.portfolioId,
    created_at: existing.created_at,
    updated_at: now
  }
}

export function deleteTransaction(id: string): void {
  const db = getDatabase()

  const existingRow = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existingRow) {
    throw new Error(`Transaction ${id} not found`)
  }
  const existing = rowToTransaction(existingRow)
  const portfolioId = existing.portfolioId ?? undefined

  db.transaction(() => {
    removeAssignmentsForTransaction(id)
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    recomputeLotsForTicker(existing.ticker, portfolioId)
  })()
}

export function getTransactions(filters?: TransactionFilters): ReadonlyArray<Transaction> {
  const db = getDatabase()
  const conditions: string[] = ["asset_type = 'EQUITY'"]
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
  if (filters?.portfolioId !== undefined) {
    conditions.push('portfolio_id = ?')
    params.push(filters.portfolioId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM transactions ${where} ORDER BY date ASC, created_at ASC`).all(...params) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as string,
    ticker: row.ticker as string,
    type: row.type as Transaction['type'],
    shares: row.shares as number,
    price: row.price as number,
    date: row.date as string,
    fees: row.fees as number,
    notes: row.notes as string | null,
    portfolioId: row.portfolio_id as number | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }))
}

export function getPositions(portfolioId?: number): ReadonlyArray<Position> {
  const db = getDatabase()

  let query = "SELECT DISTINCT ticker FROM transactions WHERE asset_type = 'EQUITY'"
  const params: unknown[] = []

  if (portfolioId !== undefined) {
    query += ' AND portfolio_id = ?'
    params.push(portfolioId)
  }

  query += ' ORDER BY ticker'
  const tickers = db.prepare(query).all(...params) as Array<{ ticker: string }>

  return tickers.map((row) => computePosition(row.ticker, portfolioId))
}

function computePosition(ticker: string, portfolioId?: number): Position {
  const db = getDatabase()

  let txQuery = "SELECT * FROM transactions WHERE ticker = ? AND asset_type = 'EQUITY'"
  const txParams: unknown[] = [ticker]

  if (portfolioId !== undefined) {
    txQuery += ' AND portfolio_id = ?'
    txParams.push(portfolioId)
  }

  txQuery += ' ORDER BY date ASC, created_at ASC'
  const transactions = db.prepare(txQuery).all(...txParams) as Transaction[]

  let firstBuyDate: string | null = null
  let lastSellDate: string | null = null

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      if (firstBuyDate === null || tx.date < firstBuyDate) {
        firstBuyDate = tx.date
      }
    } else {
      if (lastSellDate === null || tx.date > lastSellDate) {
        lastSellDate = tx.date
      }
    }
  }

  const totalInvested = transactions
    .filter((tx) => tx.type === 'BUY')
    .reduce((sum, tx) => sum + tx.shares * tx.price, 0)

  let lotsQuery = 'SELECT tl.remaining_shares, tl.cost_per_share FROM tax_lots tl'
  const lotsParams: unknown[] = [ticker]

  if (portfolioId !== undefined) {
    lotsQuery += ' JOIN transactions t ON tl.transaction_id = t.id WHERE tl.ticker = ? AND tl.remaining_shares > 0 AND t.portfolio_id = ?'
    lotsParams.push(portfolioId)
  } else {
    lotsQuery += ' WHERE tl.ticker = ? AND tl.remaining_shares > 0'
  }

  const remainingLots = db.prepare(lotsQuery).all(...lotsParams) as ReadonlyArray<{ remaining_shares: number; cost_per_share: number }>

  let totalShares = 0
  let totalRemainingCost = 0
  for (const lot of remainingLots) {
    totalShares += lot.remaining_shares
    totalRemainingCost += lot.remaining_shares * lot.cost_per_share
  }
  const costBasis = totalShares > 0 ? totalRemainingCost / totalShares : 0

  let assignQuery = `
    SELECT la.realized_gain, la.is_short_term FROM lot_assignments la
    JOIN tax_lots tl ON la.tax_lot_id = tl.id`
  const assignParams: unknown[] = [ticker]

  if (portfolioId !== undefined) {
    assignQuery += `
    JOIN transactions t ON tl.transaction_id = t.id
    WHERE tl.ticker = ? AND t.portfolio_id = ?`
    assignParams.push(portfolioId)
  } else {
    assignQuery += `
    WHERE tl.ticker = ?`
  }

  const assignments = db.prepare(assignQuery).all(...assignParams) as ReadonlyArray<{ realized_gain: number; is_short_term: number }>

  let totalRealized = 0
  let shortTermGain = 0
  let longTermGain = 0

  for (const a of assignments) {
    totalRealized += a.realized_gain
    if (a.is_short_term === 1) {
      shortTermGain += a.realized_gain
    } else {
      longTermGain += a.realized_gain
    }
  }

  const method = getCostBasisMethod(ticker)

  const metadata = db.prepare('SELECT company_name, color FROM ticker_metadata WHERE ticker = ?').get(ticker) as
    | { company_name: string | null; color: string | null }
    | undefined

  return {
    ticker,
    companyName: metadata?.company_name ?? ticker,
    totalShares,
    costBasis,
    totalInvested,
    totalRealized,
    shortTermGain,
    longTermGain,
    costBasisMethod: method,
    status: totalShares > 0 ? 'OPEN' : 'CLOSED',
    color: metadata?.color ?? '#3B82F6',
    firstBuyDate,
    lastSellDate
  }
}

function validateSell(ticker: string, sharesToSell: number, sellDate: string, excludeId?: string, portfolioId?: number): void {
  const db = getDatabase()

  let query = `
    SELECT type, shares FROM transactions
    WHERE ticker = ? AND date <= ? AND asset_type = 'EQUITY'
  `
  const params: unknown[] = [ticker.toUpperCase(), sellDate]

  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }

  if (portfolioId !== undefined) {
    query += ' AND portfolio_id = ?'
    params.push(portfolioId)
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
