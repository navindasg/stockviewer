import { randomUUID } from 'crypto'
import { getDatabase } from './database'
import type { Transaction, CostBasisMethod, TaxLot, LotAssignment } from '../../src/types/index'

// --- Raw DB row types ---

interface TaxLotRow {
  readonly id: string
  readonly transaction_id: string
  readonly ticker: string
  readonly acquisition_date: string
  readonly shares: number
  readonly cost_per_share: number
  readonly remaining_shares: number
  readonly created_at: string
}

interface LotAssignmentRow {
  readonly id: string
  readonly sell_transaction_id: string
  readonly tax_lot_id: string
  readonly shares_consumed: number
  readonly cost_per_share: number
  readonly proceeds_per_share: number
  readonly realized_gain: number
  readonly is_short_term: number
  readonly is_wash_sale: number
  readonly wash_sale_adjustment: number
  readonly created_at: string
}

// --- Row mappers ---

function mapTaxLotRow(row: TaxLotRow): TaxLot {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    ticker: row.ticker,
    acquisitionDate: row.acquisition_date,
    shares: row.shares,
    costPerShare: row.cost_per_share,
    remainingShares: row.remaining_shares,
    createdAt: row.created_at
  }
}

function mapLotAssignmentRow(row: LotAssignmentRow): LotAssignment {
  return {
    id: row.id,
    sellTransactionId: row.sell_transaction_id,
    taxLotId: row.tax_lot_id,
    sharesConsumed: row.shares_consumed,
    costPerShare: row.cost_per_share,
    proceedsPerShare: row.proceeds_per_share,
    realizedGain: row.realized_gain,
    isShortTerm: row.is_short_term === 1,
    isWashSale: row.is_wash_sale === 1,
    washSaleAdjustment: row.wash_sale_adjustment,
    createdAt: row.created_at
  }
}

// --- Financial rounding ---

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

// --- Holding period classification (IRS rules) ---
// Holding period starts the day after acquisition.
// Must hold for MORE than one year for long-term treatment.

function isShortTermHolding(acquisitionDate: string, sellDate: string): boolean {
  const acquired = new Date(acquisitionDate)
  const sold = new Date(sellDate)
  const oneYearLater = new Date(acquired)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  oneYearLater.setDate(oneYearLater.getDate() + 1)
  return sold < oneYearLater
}

// --- Lot selection strategies ---

function selectLotsFifo(lots: ReadonlyArray<TaxLotRow>, sharesToSell: number): ReadonlyArray<{ lot: TaxLotRow; shares: number }> {
  const sorted = [...lots].sort((a, b) =>
    a.acquisition_date.localeCompare(b.acquisition_date) || a.created_at.localeCompare(b.created_at)
  )
  return allocateFromLots(sorted, sharesToSell)
}

function selectLotsLifo(lots: ReadonlyArray<TaxLotRow>, sharesToSell: number): ReadonlyArray<{ lot: TaxLotRow; shares: number }> {
  const sorted = [...lots].sort((a, b) =>
    b.acquisition_date.localeCompare(a.acquisition_date) || b.created_at.localeCompare(a.created_at)
  )
  return allocateFromLots(sorted, sharesToSell)
}

function selectLotsAvgCost(lots: ReadonlyArray<TaxLotRow>, sharesToSell: number): ReadonlyArray<{ lot: TaxLotRow; shares: number }> {
  const sorted = [...lots].sort((a, b) =>
    a.acquisition_date.localeCompare(b.acquisition_date) || a.created_at.localeCompare(b.created_at)
  )
  return allocateFromLots(sorted, sharesToSell)
}

function selectLotsSpecific(
  lots: ReadonlyArray<TaxLotRow>,
  sharesToSell: number,
  lotSelections: ReadonlyArray<{ lotId: string; shares: number }>
): ReadonlyArray<{ lot: TaxLotRow; shares: number }> {
  const lotMap = new Map(lots.map((l) => [l.id, l]))
  const result: Array<{ lot: TaxLotRow; shares: number }> = []
  let totalSelected = 0

  for (const selection of lotSelections) {
    const lot = lotMap.get(selection.lotId)
    if (!lot) {
      throw new Error(`Tax lot ${selection.lotId} not found`)
    }
    if (selection.shares > lot.remaining_shares) {
      throw new Error(
        `Cannot consume ${selection.shares} shares from lot ${selection.lotId}. Only ${lot.remaining_shares} remaining.`
      )
    }
    result.push({ lot, shares: selection.shares })
    totalSelected += selection.shares
  }

  const tolerance = 0.0001
  if (Math.abs(totalSelected - sharesToSell) > tolerance) {
    throw new Error(
      `Selected lot shares (${totalSelected}) must equal shares to sell (${sharesToSell})`
    )
  }

  return result
}

function allocateFromLots(
  sortedLots: ReadonlyArray<TaxLotRow>,
  sharesToSell: number
): ReadonlyArray<{ lot: TaxLotRow; shares: number }> {
  const result: Array<{ lot: TaxLotRow; shares: number }> = []
  let remaining = sharesToSell

  for (const lot of sortedLots) {
    if (remaining <= 0) break
    if (lot.remaining_shares <= 0) continue

    const sharesToTake = Math.min(lot.remaining_shares, remaining)
    result.push({ lot, shares: sharesToTake })
    remaining -= sharesToTake
  }

  const tolerance = 0.0001
  if (remaining > tolerance) {
    throw new Error(
      `Insufficient shares in tax lots. Need ${sharesToSell}, but only ${sharesToSell - remaining} available.`
    )
  }

  return result
}

// --- Wash sale detection ---

function detectWashSale(ticker: string, sellDate: string, sellTransactionId: string): boolean {
  const db = getDatabase()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const sellTime = new Date(sellDate).getTime()
  const windowStart = new Date(sellTime - thirtyDaysMs).toISOString()
  const windowEnd = new Date(sellTime + thirtyDaysMs).toISOString()

  const buyInWindow = db.prepare(`
    SELECT COUNT(*) as count FROM transactions
    WHERE ticker = ? AND type = 'BUY' AND id != ?
      AND date >= ? AND date <= ?
  `).get(ticker, sellTransactionId, windowStart, windowEnd) as { count: number }

  return buyInWindow.count > 0
}

// --- Average cost computation for AVGCOST method ---

function computeAvgCostPerShare(lots: ReadonlyArray<TaxLotRow>): number {
  let totalCost = 0
  let totalShares = 0
  for (const lot of lots) {
    if (lot.remaining_shares > 0) {
      totalCost += lot.remaining_shares * lot.cost_per_share
      totalShares += lot.remaining_shares
    }
  }
  return totalShares > 0 ? roundToCents(totalCost / totalShares) : 0
}

// --- Public API ---

export function createTaxLot(transaction: Transaction): TaxLot {
  if (transaction.type !== 'BUY') {
    throw new Error('Tax lots can only be created from BUY transactions')
  }

  const db = getDatabase()
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO tax_lots (id, transaction_id, ticker, acquisition_date, shares, cost_per_share, remaining_shares, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, transaction.id, transaction.ticker, transaction.date, transaction.shares, transaction.price, transaction.shares, now)

  return {
    id,
    transactionId: transaction.id,
    ticker: transaction.ticker,
    acquisitionDate: transaction.date,
    shares: transaction.shares,
    costPerShare: transaction.price,
    remainingShares: transaction.shares,
    createdAt: now
  }
}

export function assignLotsForSell(
  sellTransaction: Transaction,
  method: CostBasisMethod,
  lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>
): ReadonlyArray<LotAssignment> {
  if (sellTransaction.type !== 'SELL') {
    throw new Error('Lot assignments can only be created for SELL transactions')
  }

  const db = getDatabase()
  const lots = db.prepare(
    'SELECT * FROM tax_lots WHERE ticker = ? AND remaining_shares > 0 ORDER BY acquisition_date ASC'
  ).all(sellTransaction.ticker) as TaxLotRow[]

  let selections: ReadonlyArray<{ lot: TaxLotRow; shares: number }>

  switch (method) {
    case 'FIFO':
      selections = selectLotsFifo(lots, sellTransaction.shares)
      break
    case 'LIFO':
      selections = selectLotsLifo(lots, sellTransaction.shares)
      break
    case 'AVGCOST':
      selections = selectLotsAvgCost(lots, sellTransaction.shares)
      break
    case 'SPECIFIC':
      if (!lotSelections || lotSelections.length === 0) {
        throw new Error('Specific lot selections required for SPECIFIC method')
      }
      selections = selectLotsSpecific(lots, sellTransaction.shares, lotSelections)
      break
  }

  const isWashSale = detectWashSale(sellTransaction.ticker, sellTransaction.date, sellTransaction.id)
  const avgCost = method === 'AVGCOST' ? computeAvgCostPerShare(lots) : 0
  const assignments: LotAssignment[] = []

  const assignLot = db.prepare(`
    INSERT INTO lot_assignments (id, sell_transaction_id, tax_lot_id, shares_consumed, cost_per_share, proceeds_per_share, realized_gain, is_short_term, is_wash_sale, wash_sale_adjustment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const updateLotShares = db.prepare(
    'UPDATE tax_lots SET remaining_shares = remaining_shares - ? WHERE id = ?'
  )

  const runAssignment = db.transaction(() => {
    for (const { lot, shares } of selections) {
      const costBasis = method === 'AVGCOST' ? roundToCents(avgCost) : lot.cost_per_share
      const realizedGain = roundToCents((sellTransaction.price - costBasis) * shares)
      const shortTerm = isShortTermHolding(lot.acquisition_date, sellTransaction.date)

      let washSaleAdj = 0
      if (isWashSale && realizedGain < 0) {
        washSaleAdj = roundToCents(Math.abs(realizedGain))
      }

      const assignmentId = randomUUID()
      const now = new Date().toISOString()

      assignLot.run(
        assignmentId,
        sellTransaction.id,
        lot.id,
        shares,
        costBasis,
        sellTransaction.price,
        realizedGain,
        shortTerm ? 1 : 0,
        isWashSale && realizedGain < 0 ? 1 : 0,
        washSaleAdj,
        now
      )

      updateLotShares.run(shares, lot.id)

      if (isWashSale && washSaleAdj > 0) {
        adjustReplacementLotCostBasis(sellTransaction.ticker, sellTransaction.date, washSaleAdj, shares)
      }

      assignments.push({
        id: assignmentId,
        sellTransactionId: sellTransaction.id,
        taxLotId: lot.id,
        sharesConsumed: shares,
        costPerShare: costBasis,
        proceedsPerShare: sellTransaction.price,
        realizedGain,
        isShortTerm: shortTerm,
        isWashSale: isWashSale && realizedGain < 0,
        washSaleAdjustment: washSaleAdj,
        createdAt: now
      })
    }
  })

  runAssignment()
  return assignments
}

function adjustReplacementLotCostBasis(
  ticker: string,
  sellDate: string,
  washSaleAdjustment: number,
  sharesAdjusted: number
): void {
  const db = getDatabase()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const sellTime = new Date(sellDate).getTime()
  const windowEnd = new Date(sellTime + thirtyDaysMs).toISOString()

  const replacementLot = db.prepare(`
    SELECT id, remaining_shares FROM tax_lots
    WHERE ticker = ? AND acquisition_date >= ? AND acquisition_date <= ? AND remaining_shares > 0
    ORDER BY acquisition_date ASC
    LIMIT 1
  `).get(ticker, sellDate, windowEnd) as TaxLotRow | undefined

  if (replacementLot) {
    const adjustmentPerShare = roundToCents(washSaleAdjustment / sharesAdjusted)
    db.prepare(
      'UPDATE tax_lots SET cost_per_share = cost_per_share + ? WHERE id = ?'
    ).run(adjustmentPerShare, replacementLot.id)
  }
}

export function removeAssignmentsForTransaction(transactionId: string): void {
  const db = getDatabase()

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as Transaction | undefined
  if (!transaction) return

  if (transaction.type === 'BUY') {
    const lot = db.prepare('SELECT id FROM tax_lots WHERE transaction_id = ?').get(transactionId) as { id: string } | undefined
    if (lot) {
      db.prepare('DELETE FROM lot_assignments WHERE tax_lot_id = ?').run(lot.id)
      db.prepare('DELETE FROM tax_lots WHERE id = ?').run(lot.id)
    }
  } else {
    const assignments = db.prepare(
      'SELECT tax_lot_id, shares_consumed FROM lot_assignments WHERE sell_transaction_id = ?'
    ).all(transactionId) as Array<{ tax_lot_id: string; shares_consumed: number }>

    const restoreLot = db.prepare(
      'UPDATE tax_lots SET remaining_shares = remaining_shares + ? WHERE id = ?'
    )

    db.transaction(() => {
      for (const assignment of assignments) {
        restoreLot.run(assignment.shares_consumed, assignment.tax_lot_id)
      }
      db.prepare('DELETE FROM lot_assignments WHERE sell_transaction_id = ?').run(transactionId)
    })()
  }
}

export function getTaxLots(ticker: string): ReadonlyArray<TaxLot> {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT * FROM tax_lots WHERE ticker = ? ORDER BY acquisition_date ASC, created_at ASC'
  ).all(ticker) as TaxLotRow[]
  return rows.map(mapTaxLotRow)
}

export function getAvailableLots(ticker: string): ReadonlyArray<TaxLot> {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT * FROM tax_lots WHERE ticker = ? AND remaining_shares > 0 ORDER BY acquisition_date ASC, created_at ASC'
  ).all(ticker) as TaxLotRow[]
  return rows.map(mapTaxLotRow)
}

export function getLotAssignments(sellTransactionId: string): ReadonlyArray<LotAssignment> {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT * FROM lot_assignments WHERE sell_transaction_id = ? ORDER BY created_at ASC'
  ).all(sellTransactionId) as LotAssignmentRow[]
  return rows.map(mapLotAssignmentRow)
}

export function getCostBasisMethod(ticker: string): CostBasisMethod {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT cost_basis_method FROM ticker_metadata WHERE ticker = ?'
  ).get(ticker) as { cost_basis_method: string } | undefined

  return (row?.cost_basis_method as CostBasisMethod) ?? 'AVGCOST'
}

export function setCostBasisMethod(ticker: string, method: CostBasisMethod): void {
  const validMethods: ReadonlyArray<CostBasisMethod> = ['FIFO', 'LIFO', 'AVGCOST', 'SPECIFIC']
  if (!validMethods.includes(method)) {
    throw new Error(`Invalid cost basis method: ${method}`)
  }

  const db = getDatabase()

  const existing = db.prepare('SELECT ticker FROM ticker_metadata WHERE ticker = ?').get(ticker)
  if (existing) {
    db.prepare(
      'UPDATE ticker_metadata SET cost_basis_method = ?, updated_at = datetime(\'now\') WHERE ticker = ?'
    ).run(method, ticker)
  } else {
    db.prepare(
      'INSERT INTO ticker_metadata (ticker, cost_basis_method, updated_at) VALUES (?, ?, datetime(\'now\'))'
    ).run(ticker, method)
  }
}

export function recomputeLotsForTicker(ticker: string): void {
  const db = getDatabase()
  const method = getCostBasisMethod(ticker)

  db.transaction(() => {
    db.prepare('DELETE FROM lot_assignments WHERE tax_lot_id IN (SELECT id FROM tax_lots WHERE ticker = ?)').run(ticker)
    db.prepare('DELETE FROM tax_lots WHERE ticker = ?').run(ticker)

    const transactions = db.prepare(
      'SELECT * FROM transactions WHERE ticker = ? ORDER BY date ASC, created_at ASC'
    ).all(ticker) as Transaction[]

    for (const tx of transactions) {
      if (tx.type === 'BUY') {
        createTaxLot(tx)
      } else {
        assignLotsForSell(tx, method)
      }
    }
  })()
}

export function getAllLotAssignmentsForTicker(ticker: string): ReadonlyArray<LotAssignment> {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT la.* FROM lot_assignments la
    JOIN tax_lots tl ON la.tax_lot_id = tl.id
    WHERE tl.ticker = ?
    ORDER BY la.created_at ASC
  `).all(ticker) as LotAssignmentRow[]
  return rows.map(mapLotAssignmentRow)
}
