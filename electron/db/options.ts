import { randomUUID } from 'crypto'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { getDatabase } from './database'
import { getDefaultPortfolioId } from './portfolios'
import { buildOccSymbol } from '../../src/utils/occSymbol'
import type {
  OptionAction,
  OptionType,
  OptionPosition,
  OptionPositionFilters,
  OptionPositionStatus,
  NewOptionTransaction,
  OptionTransaction
} from '../../src/types/options'

const OPENING_ACTIONS = new Set<OptionAction>(['BUY_TO_OPEN', 'SELL_TO_OPEN'])
const CLOSING_ACTIONS = new Set<OptionAction>(['SELL_TO_CLOSE', 'BUY_TO_CLOSE', 'EXERCISE', 'ASSIGNMENT', 'EXPIRE'])

function deriveTransactionType(action: OptionAction): 'BUY' | 'SELL' {
  switch (action) {
    case 'BUY_TO_OPEN':
    case 'BUY_TO_CLOSE':
      return 'BUY'
    case 'SELL_TO_OPEN':
    case 'SELL_TO_CLOSE':
    case 'EXPIRE':
    case 'EXERCISE':
    case 'ASSIGNMENT':
      return 'SELL'
  }
}

export function addOptionTransaction(tx: NewOptionTransaction): OptionTransaction {
  const db = getDatabase()
  const id = randomUUID()
  const now = new Date().toISOString()
  const ticker = tx.ticker.toUpperCase()
  const type = deriveTransactionType(tx.optionAction)
  const fees = tx.fees ?? 0
  const notes = tx.notes ?? null
  const multiplier = 100
  const portfolioId = tx.portfolioId ?? getDefaultPortfolioId()

  if (CLOSING_ACTIONS.has(tx.optionAction) && tx.optionAction !== 'EXPIRE') {
    validateOptionClose(ticker, tx.optionType, tx.strikePrice, tx.expirationDate, tx.contracts, tx.optionAction, portfolioId)
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (
      id, ticker, type, shares, price, date, fees, notes,
      asset_type, option_type, strike_price, expiration_date, contract_multiplier, option_action,
      portfolio_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPTION', ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id, ticker, type, tx.contracts, tx.price, tx.date, fees, notes,
    tx.optionType, tx.strikePrice, tx.expirationDate, multiplier, tx.optionAction,
    portfolioId, now, now
  )

  return {
    id,
    ticker,
    assetType: 'OPTION',
    type,
    optionAction: tx.optionAction,
    optionType: tx.optionType,
    strikePrice: tx.strikePrice,
    expirationDate: tx.expirationDate,
    contractMultiplier: multiplier,
    shares: tx.contracts,
    price: tx.price,
    date: tx.date,
    fees,
    notes,
    created_at: now,
    updated_at: now
  }
}

export function deleteOptionTransaction(id: string): void {
  const db = getDatabase()
  const existing = db.prepare(
    "SELECT * FROM transactions WHERE id = ? AND asset_type = 'OPTION'"
  ).get(id) as Record<string, unknown> | undefined

  if (!existing) {
    throw new Error(`Option transaction ${id} not found`)
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
}

export function getOptionTransactions(
  filters?: OptionPositionFilters
): ReadonlyArray<OptionTransaction> {
  const db = getDatabase()
  const conditions: string[] = ["asset_type = 'OPTION'"]
  const params: unknown[] = []

  if (filters?.ticker) {
    conditions.push('ticker = ?')
    params.push(filters.ticker.toUpperCase())
  }
  if (filters?.optionType) {
    conditions.push('option_type = ?')
    params.push(filters.optionType)
  }
  if (filters?.portfolioId !== undefined) {
    conditions.push('portfolio_id = ?')
    params.push(filters.portfolioId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(
    `SELECT * FROM transactions ${where} ORDER BY date ASC, created_at ASC`
  ).all(...params) as ReadonlyArray<Record<string, unknown>>

  return rows.map(mapRowToOptionTransaction)
}

export function getOptionPositions(
  filters?: OptionPositionFilters
): ReadonlyArray<OptionPosition> {
  const db = getDatabase()

  let query = "SELECT DISTINCT ticker, option_type, strike_price, expiration_date FROM transactions WHERE asset_type = 'OPTION'"
  const params: unknown[] = []

  if (filters?.ticker) {
    query += ' AND ticker = ?'
    params.push(filters.ticker.toUpperCase())
  }
  if (filters?.optionType) {
    query += ' AND option_type = ?'
    params.push(filters.optionType)
  }
  if (filters?.portfolioId !== undefined) {
    query += ' AND portfolio_id = ?'
    params.push(filters.portfolioId)
  }

  query += ' ORDER BY ticker, expiration_date, strike_price'

  const groups = db.prepare(query).all(...params) as ReadonlyArray<{
    ticker: string
    option_type: string
    strike_price: number
    expiration_date: string
  }>

  const positions = groups.map((g) =>
    computeOptionPosition(g.ticker, g.option_type as OptionType, g.strike_price, g.expiration_date)
  )

  if (filters?.status) {
    return positions.filter((p) => p.status === filters.status)
  }

  return positions
}

function computeOptionPosition(
  ticker: string,
  optionType: OptionType,
  strikePrice: number,
  expirationDate: string
): OptionPosition {
  const db = getDatabase()
  const multiplier = 100

  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE asset_type = 'OPTION' AND ticker = ? AND option_type = ? AND strike_price = ? AND expiration_date = ?
    ORDER BY date ASC, created_at ASC
  `).all(ticker, optionType, strikePrice, expirationDate) as ReadonlyArray<Record<string, unknown>>

  let openContracts = 0
  let totalPremiumPaid = 0
  let totalPremiumReceived = 0
  let realizedPnl = 0
  let firstTradeDate: string | null = null
  let lastTradeDate: string | null = null
  let direction: 'LONG' | 'SHORT' = 'LONG'
  let directionSet = false

  for (const tx of transactions) {
    const action = tx.option_action as OptionAction
    const contracts = tx.shares as number
    const price = tx.price as number
    const date = tx.date as string

    if (firstTradeDate === null || date < firstTradeDate) {
      firstTradeDate = date
    }
    if (lastTradeDate === null || date > lastTradeDate) {
      lastTradeDate = date
    }

    if (OPENING_ACTIONS.has(action)) {
      if (!directionSet) {
        direction = action === 'BUY_TO_OPEN' ? 'LONG' : 'SHORT'
        directionSet = true
      }

      if (action === 'BUY_TO_OPEN') {
        openContracts += contracts
        totalPremiumPaid += contracts * price * multiplier
      } else {
        openContracts += contracts
        totalPremiumReceived += contracts * price * multiplier
      }
    } else if (CLOSING_ACTIONS.has(action)) {
      const closingContracts = Math.min(contracts, openContracts)

      if (action === 'SELL_TO_CLOSE') {
        // Closing a long position: proceeds reduce exposure
        const proceeds = closingContracts * price * multiplier
        const costPerContract = openContracts > 0 ? totalPremiumPaid / openContracts : 0
        realizedPnl += proceeds - (costPerContract * closingContracts)
        totalPremiumPaid -= costPerContract * closingContracts
      } else if (action === 'BUY_TO_CLOSE') {
        // Closing a short position: cost to close reduces gains
        const cost = closingContracts * price * multiplier
        const revenuePerContract = openContracts > 0 ? totalPremiumReceived / openContracts : 0
        realizedPnl += (revenuePerContract * closingContracts) - cost
        totalPremiumReceived -= revenuePerContract * closingContracts
      } else if (action === 'EXPIRE') {
        // Worthless expiry
        if (direction === 'LONG') {
          const costPerContract = openContracts > 0 ? totalPremiumPaid / openContracts : 0
          realizedPnl -= costPerContract * closingContracts
          totalPremiumPaid -= costPerContract * closingContracts
        } else {
          const revenuePerContract = openContracts > 0 ? totalPremiumReceived / openContracts : 0
          realizedPnl += revenuePerContract * closingContracts
          totalPremiumReceived -= revenuePerContract * closingContracts
        }
      } else if (action === 'EXERCISE' || action === 'ASSIGNMENT') {
        // Premium portion is realized; underlying trade is separate
        if (direction === 'LONG') {
          const costPerContract = openContracts > 0 ? totalPremiumPaid / openContracts : 0
          realizedPnl -= costPerContract * closingContracts
          totalPremiumPaid -= costPerContract * closingContracts
        } else {
          const revenuePerContract = openContracts > 0 ? totalPremiumReceived / openContracts : 0
          realizedPnl += revenuePerContract * closingContracts
          totalPremiumReceived -= revenuePerContract * closingContracts
        }
      }

      openContracts = Math.max(0, openContracts - closingContracts)
    }
  }

  const now = new Date()
  const expDate = parseISO(expirationDate)
  const daysToExpiration = Math.max(0, differenceInCalendarDays(expDate, now))
  const isExpired = now > expDate

  const occSymbol = buildOccSymbol(ticker, expirationDate, optionType, strikePrice)
  const totalCost = direction === 'LONG' ? totalPremiumPaid : totalPremiumReceived
  const avgCostPerContract = openContracts > 0
    ? totalCost / openContracts
    : 0

  let status: OptionPositionStatus = 'OPEN'
  if (openContracts === 0) {
    status = 'CLOSED'
  } else if (isExpired) {
    status = 'EXPIRED'
  }

  const metadata = db.prepare(
    'SELECT company_name FROM ticker_metadata WHERE ticker = ?'
  ).get(ticker) as { company_name: string | null } | undefined

  return {
    occSymbol,
    underlyingTicker: ticker,
    optionType,
    strikePrice,
    expirationDate,
    contractMultiplier: multiplier,
    openContracts,
    avgCostPerContract,
    totalPremiumPaid,
    totalPremiumReceived,
    realizedPnl,
    status,
    isExpired,
    daysToExpiration,
    direction,
    firstTradeDate,
    lastTradeDate,
    companyName: metadata?.company_name ?? ticker
  }
}

function validateOptionClose(
  ticker: string,
  optionType: OptionType,
  strikePrice: number,
  expirationDate: string,
  contractsToClose: number,
  action: OptionAction,
  portfolioId?: number
): void {
  const db = getDatabase()

  let query = `
    SELECT option_action, shares FROM transactions
    WHERE asset_type = 'OPTION' AND ticker = ? AND option_type = ? AND strike_price = ? AND expiration_date = ?`
  const params: unknown[] = [ticker, optionType, strikePrice, expirationDate]

  if (portfolioId !== undefined) {
    query += ' AND portfolio_id = ?'
    params.push(portfolioId)
  }

  query += ' ORDER BY date ASC, created_at ASC'

  const transactions = db.prepare(query).all(...params) as ReadonlyArray<{
    option_action: string
    shares: number
  }>

  let openContracts = 0
  for (const tx of transactions) {
    if (OPENING_ACTIONS.has(tx.option_action as OptionAction)) {
      openContracts += tx.shares
    } else if (CLOSING_ACTIONS.has(tx.option_action as OptionAction)) {
      openContracts -= tx.shares
    }
  }

  if (contractsToClose > openContracts) {
    const occSymbol = buildOccSymbol(ticker, expirationDate, optionType, strikePrice)
    throw new Error(
      `Cannot ${action} ${contractsToClose} contracts of ${occSymbol}. Only ${openContracts} contracts open.`
    )
  }
}

function mapRowToOptionTransaction(row: Record<string, unknown>): OptionTransaction {
  return {
    id: row.id as string,
    ticker: row.ticker as string,
    assetType: 'OPTION',
    type: row.type as 'BUY' | 'SELL',
    optionAction: row.option_action as OptionAction,
    optionType: row.option_type as OptionType,
    strikePrice: row.strike_price as number,
    expirationDate: row.expiration_date as string,
    contractMultiplier: (row.contract_multiplier as number) ?? 100,
    shares: row.shares as number,
    price: row.price as number,
    date: row.date as string,
    fees: row.fees as number,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}
