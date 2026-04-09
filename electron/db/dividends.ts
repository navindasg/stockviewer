import { randomUUID } from 'crypto'
import { getDatabase } from './database'
import { addTransaction } from './positions'
import { getDefaultPortfolioId } from './portfolios'
import type {
  Dividend,
  NewDividend,
  DividendFilters,
  DividendSummary,
  PortfolioDividendSummary
} from '../../src/types/index'

interface DividendRow {
  readonly id: string
  readonly ticker: string
  readonly ex_date: string
  readonly pay_date: string
  readonly amount_per_share: number
  readonly total_amount: number
  readonly shares_at_date: number
  readonly type: string
  readonly linked_transaction_id: string | null
  readonly portfolio_id: number | null
  readonly notes: string | null
  readonly created_at: string
  readonly updated_at: string
}

function rowToDividend(row: DividendRow): Dividend {
  return {
    id: row.id,
    ticker: row.ticker,
    exDate: row.ex_date,
    payDate: row.pay_date,
    amountPerShare: row.amount_per_share,
    totalAmount: row.total_amount,
    sharesAtDate: row.shares_at_date,
    type: row.type as Dividend['type'],
    linkedTransactionId: row.linked_transaction_id,
    portfolioId: row.portfolio_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function addDividend(input: NewDividend): Dividend {
  const db = getDatabase()
  const id = randomUUID()
  const now = new Date().toISOString()
  const ticker = input.ticker.toUpperCase()
  const totalAmount = input.amountPerShare * input.sharesAtDate
  const notes = input.notes ?? null
  const portfolioId = input.portfolioId ?? getDefaultPortfolioId()

  let linkedTransactionId: string | null = null

  return db.transaction(() => {
    if (input.type === 'REINVESTED') {
      const dripPrice = getDripPrice(ticker, input.payDate)
      if (dripPrice <= 0) {
        throw new Error(`DRIP price for ${ticker} is invalid (${dripPrice}). Cannot reinvest.`)
      }
      const dripShares = totalAmount / dripPrice
      const dripTransaction = addTransaction({
        ticker,
        type: 'BUY',
        shares: dripShares,
        price: dripPrice,
        date: input.payDate,
        fees: 0,
        notes: `DRIP reinvestment from ${input.exDate} dividend`,
        portfolioId
      })
      linkedTransactionId = dripTransaction.id
    }

    db.prepare(`
      INSERT INTO dividends (id, ticker, ex_date, pay_date, amount_per_share, total_amount, shares_at_date, type, linked_transaction_id, portfolio_id, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ticker, input.exDate, input.payDate,
      input.amountPerShare, totalAmount, input.sharesAtDate,
      input.type, linkedTransactionId, portfolioId, notes, now, now
    )

    return {
      id,
      ticker,
      exDate: input.exDate,
      payDate: input.payDate,
      amountPerShare: input.amountPerShare,
      totalAmount,
      sharesAtDate: input.sharesAtDate,
      type: input.type,
      linkedTransactionId,
      portfolioId,
      notes,
      createdAt: now,
      updatedAt: now
    }
  })()
}

function getDripPrice(ticker: string, payDate: string): number {
  const db = getDatabase()

  const cached = db.prepare(
    'SELECT close FROM price_cache WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT 1'
  ).get(ticker, payDate) as { close: number } | undefined

  if (cached) {
    return cached.close
  }

  const lastBuy = db.prepare(
    'SELECT price FROM transactions WHERE ticker = ? AND type = ? AND date <= ? ORDER BY date DESC LIMIT 1'
  ).get(ticker, 'BUY', payDate) as { price: number } | undefined

  if (lastBuy) {
    return lastBuy.price
  }

  throw new Error(
    `Cannot determine DRIP price for ${ticker} on ${payDate}. No price data available.`
  )
}

export function getDividends(filters?: DividendFilters): ReadonlyArray<Dividend> {
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
    conditions.push('ex_date >= ?')
    params.push(filters.fromDate)
  }
  if (filters?.toDate) {
    conditions.push('ex_date <= ?')
    params.push(filters.toDate)
  }
  if (filters?.portfolioId !== undefined) {
    conditions.push('portfolio_id = ?')
    params.push(filters.portfolioId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(
    `SELECT * FROM dividends ${where} ORDER BY ex_date DESC, created_at DESC`
  ).all(...params) as DividendRow[]

  return rows.map(rowToDividend)
}

export function updateDividend(id: string, updates: Partial<NewDividend>): Dividend {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM dividends WHERE id = ?').get(id) as DividendRow | undefined
  if (!existing) {
    throw new Error(`Dividend ${id} not found`)
  }

  const ticker = updates.ticker?.toUpperCase() ?? existing.ticker
  const amountPerShare = updates.amountPerShare ?? existing.amount_per_share
  const sharesAtDate = updates.sharesAtDate ?? existing.shares_at_date
  const totalAmount = amountPerShare * sharesAtDate
  const now = new Date().toISOString()

  const merged = {
    ticker,
    exDate: updates.exDate ?? existing.ex_date,
    payDate: updates.payDate ?? existing.pay_date,
    amountPerShare,
    totalAmount,
    sharesAtDate,
    type: updates.type ?? existing.type,
    notes: updates.notes !== undefined ? (updates.notes ?? null) : existing.notes
  }

  return db.transaction(() => {
    let linkedTransactionId = existing.linked_transaction_id
    const typeChanged = merged.type !== existing.type

    if (typeChanged) {
      if (existing.type === 'REINVESTED' && existing.linked_transaction_id) {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.linked_transaction_id)
        linkedTransactionId = null
      }

      if (merged.type === 'REINVESTED') {
        const dripPrice = getDripPrice(ticker, merged.payDate)
        if (dripPrice <= 0) {
          throw new Error(`DRIP price for ${ticker} is invalid (${dripPrice}). Cannot reinvest.`)
        }
        const dripShares = totalAmount / dripPrice
        const dripTransaction = addTransaction({
          ticker,
          type: 'BUY',
          shares: dripShares,
          price: dripPrice,
          date: merged.payDate,
          fees: 0,
          notes: `DRIP reinvestment from ${merged.exDate} dividend`
        })
        linkedTransactionId = dripTransaction.id
      }
    }

    db.prepare(`
      UPDATE dividends
      SET ticker = ?, ex_date = ?, pay_date = ?, amount_per_share = ?, total_amount = ?, shares_at_date = ?, type = ?, linked_transaction_id = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.ticker, merged.exDate, merged.payDate,
      merged.amountPerShare, merged.totalAmount, merged.sharesAtDate,
      merged.type, linkedTransactionId, merged.notes, now, id
    )

    return {
      id,
      ticker: merged.ticker,
      exDate: merged.exDate,
      payDate: merged.payDate,
      amountPerShare: merged.amountPerShare,
      totalAmount: merged.totalAmount,
      sharesAtDate: merged.sharesAtDate,
      type: merged.type as Dividend['type'],
      linkedTransactionId,
      portfolioId: existing.portfolio_id,
      notes: merged.notes,
      createdAt: existing.created_at,
      updatedAt: now
    }
  })()
}

export function deleteDividend(id: string): void {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM dividends WHERE id = ?').get(id) as DividendRow | undefined
  if (!existing) {
    throw new Error(`Dividend ${id} not found`)
  }

  db.transaction(() => {
    if (existing.linked_transaction_id) {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.linked_transaction_id)
    }
    db.prepare('DELETE FROM dividends WHERE id = ?').run(id)
  })()
}

export function getDividendSummary(portfolioId?: number): PortfolioDividendSummary {
  const db = getDatabase()
  const now = new Date()
  const yearStart = `${now.getFullYear()}-01-01`
  const trailing12m = new Date(now)
  trailing12m.setFullYear(trailing12m.getFullYear() - 1)
  const trailing12mStr = trailing12m.toISOString().split('T')[0]

  let query = 'SELECT * FROM dividends'
  const params: unknown[] = []

  if (portfolioId !== undefined) {
    query += ' WHERE portfolio_id = ?'
    params.push(portfolioId)
  }

  query += ' ORDER BY ex_date DESC'
  const allDividends = db.prepare(query).all(...params) as DividendRow[]

  if (allDividends.length === 0) {
    return {
      totalIncomeAllTime: 0,
      totalIncomeYtd: 0,
      totalIncomeTrailing12m: 0,
      totalAnnualizedIncome: 0,
      averageYield: 0,
      perTicker: []
    }
  }

  const tickerMap = new Map<string, DividendRow[]>()
  for (const row of allDividends) {
    const existing = tickerMap.get(row.ticker) ?? []
    tickerMap.set(row.ticker, [...existing, row])
  }

  let totalIncomeAllTime = 0
  let totalIncomeYtd = 0
  let totalIncomeTrailing12m = 0

  const perTicker: DividendSummary[] = []

  for (const [ticker, rows] of tickerMap) {
    let tickerTotal = 0
    let tickerYtd = 0
    let tickerTrailing12m = 0
    let lastPayDate: string | null = null

    for (const row of rows) {
      tickerTotal += row.total_amount

      if (row.pay_date >= yearStart) {
        tickerYtd += row.total_amount
      }
      if (row.pay_date >= trailing12mStr) {
        tickerTrailing12m += row.total_amount
      }

      if (lastPayDate === null || row.pay_date > lastPayDate) {
        lastPayDate = row.pay_date
      }
    }

    totalIncomeAllTime += tickerTotal
    totalIncomeYtd += tickerYtd
    totalIncomeTrailing12m += tickerTrailing12m

    const metadata = db.prepare(
      'SELECT company_name FROM ticker_metadata WHERE ticker = ?'
    ).get(ticker) as { company_name: string | null } | undefined

    const annualizedIncome = computeAnnualizedIncome(rows)

    perTicker.push({
      ticker,
      companyName: metadata?.company_name ?? ticker,
      totalIncome: tickerTotal,
      ytdIncome: tickerYtd,
      trailing12mIncome: tickerTrailing12m,
      paymentCount: rows.length,
      lastPayDate,
      annualizedIncome,
      dividendYield: 0
    })
  }

  const totalAnnualizedIncome = perTicker.reduce(
    (sum, s) => sum + s.annualizedIncome, 0
  )

  return {
    totalIncomeAllTime,
    totalIncomeYtd,
    totalIncomeTrailing12m,
    totalAnnualizedIncome,
    averageYield: 0,
    perTicker
  }
}

function computeAnnualizedIncome(rows: ReadonlyArray<DividendRow>): number {
  if (rows.length === 0) {
    return 0
  }
  if (rows.length === 1) {
    // Single payment — return as-is; insufficient data to annualize
    return rows[0].total_amount
  }

  const sorted = [...rows].sort((a, b) => a.pay_date.localeCompare(b.pay_date))
  const earliest = new Date(sorted[0].pay_date)
  const latest = new Date(sorted[sorted.length - 1].pay_date)
  const daySpan = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)

  if (daySpan <= 0) {
    return rows.reduce((sum, r) => sum + r.total_amount, 0)
  }

  const totalIncome = rows.reduce((sum, r) => sum + r.total_amount, 0)
  return (totalIncome / daySpan) * 365
}

export function getTotalDividendIncome(portfolioId?: number): number {
  const db = getDatabase()

  let query = 'SELECT COALESCE(SUM(total_amount), 0) as total FROM dividends'
  const params: unknown[] = []

  if (portfolioId !== undefined) {
    query += ' WHERE portfolio_id = ?'
    params.push(portfolioId)
  }

  const result = db.prepare(query).get(...params) as { total: number }
  return result.total
}
