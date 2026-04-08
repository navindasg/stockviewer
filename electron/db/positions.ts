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

  if (tx.type === 'SELL') {
    validateSell(ticker, tx.shares, tx.date)
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (id, ticker, type, shares, price, date, fees, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, ticker, tx.type, tx.shares, tx.price, tx.date, fees, notes, now, now)

  const transaction: Transaction = {
    id,
    ticker,
    type: tx.type,
    shares: tx.shares,
    price: tx.price,
    date: tx.date,
    fees,
    notes,
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

  db.transaction(() => {
    db.prepare(`
      UPDATE transactions
      SET ticker = ?, type = ?, shares = ?, price = ?, date = ?, fees = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(merged.ticker, merged.type, merged.shares, merged.price, merged.date, merged.fees, merged.notes, now, id)

    recomputeLotsForTicker(merged.ticker)
    if (existing.ticker !== merged.ticker) {
      recomputeLotsForTicker(existing.ticker)
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
    created_at: existing.created_at,
    updated_at: now
  }
}

export function deleteTransaction(id: string): void {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined
  if (!existing) {
    throw new Error(`Transaction ${id} not found`)
  }

  db.transaction(() => {
    removeAssignmentsForTransaction(id)
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    recomputeLotsForTicker(existing.ticker)
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM transactions ${where} ORDER BY date ASC, created_at ASC`).all(...params)

  return rows as Transaction[]
}

export function getPositions(): ReadonlyArray<Position> {
  const db = getDatabase()
  const tickers = db.prepare("SELECT DISTINCT ticker FROM transactions WHERE asset_type = 'EQUITY' ORDER BY ticker").all() as Array<{ ticker: string }>

  return tickers.map((row) => computePosition(row.ticker))
}

function computePosition(ticker: string): Position {
  const db = getDatabase()
  const transactions = db.prepare(
    "SELECT * FROM transactions WHERE ticker = ? AND asset_type = 'EQUITY' ORDER BY date ASC, created_at ASC"
  ).all(ticker) as Transaction[]

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

  const remainingLots = db.prepare(
    'SELECT remaining_shares, cost_per_share FROM tax_lots WHERE ticker = ? AND remaining_shares > 0'
  ).all(ticker) as ReadonlyArray<{ remaining_shares: number; cost_per_share: number }>

  let totalShares = 0
  let totalRemainingCost = 0
  for (const lot of remainingLots) {
    totalShares += lot.remaining_shares
    totalRemainingCost += lot.remaining_shares * lot.cost_per_share
  }
  const costBasis = totalShares > 0 ? totalRemainingCost / totalShares : 0

  const assignments = db.prepare(`
    SELECT la.realized_gain, la.is_short_term FROM lot_assignments la
    JOIN tax_lots tl ON la.tax_lot_id = tl.id
    WHERE tl.ticker = ?
  `).all(ticker) as ReadonlyArray<{ realized_gain: number; is_short_term: number }>

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

function validateSell(ticker: string, sharesToSell: number, sellDate: string, excludeId?: string): void {
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
