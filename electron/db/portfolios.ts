import { getDatabase } from './database'
import type { Portfolio, NewPortfolio, UpdatePortfolio, CostBasisMethod } from '../../src/types/index'

interface PortfolioRow {
  readonly id: number
  readonly name: string
  readonly description: string | null
  readonly is_default: number
  readonly default_cost_basis_method: string
  readonly created_at: string
  readonly updated_at: string
}

function rowToPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    defaultCostBasisMethod: row.default_cost_basis_method as CostBasisMethod,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listPortfolios(): ReadonlyArray<Portfolio> {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT * FROM portfolios ORDER BY is_default DESC, name ASC'
  ).all() as PortfolioRow[]
  return rows.map(rowToPortfolio)
}

export function getPortfolio(id: number): Portfolio {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT * FROM portfolios WHERE id = ?'
  ).get(id) as PortfolioRow | undefined

  if (!row) {
    throw new Error(`Portfolio ${id} not found`)
  }

  return rowToPortfolio(row)
}

export function getDefaultPortfolioId(): number {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT id FROM portfolios WHERE is_default = 1'
  ).get() as { id: number } | undefined

  if (!row) {
    throw new Error('No default portfolio found')
  }

  return row.id
}

export function createPortfolio(input: NewPortfolio): Portfolio {
  const db = getDatabase()
  const name = input.name.trim()

  if (name.length === 0 || name.length > 100) {
    throw new Error('Portfolio name must be between 1 and 100 characters')
  }

  const existing = db.prepare(
    'SELECT id FROM portfolios WHERE name = ?'
  ).get(name) as { id: number } | undefined

  if (existing) {
    throw new Error(`Portfolio "${name}" already exists`)
  }

  const description = input.description?.trim() ?? null
  const costBasisMethod = input.defaultCostBasisMethod ?? 'AVGCOST'
  const validMethods: ReadonlyArray<CostBasisMethod> = ['FIFO', 'LIFO', 'AVGCOST', 'SPECIFIC']

  if (!validMethods.includes(costBasisMethod)) {
    throw new Error(`Invalid cost basis method: ${costBasisMethod}`)
  }

  const now = new Date().toISOString()

  const result = db.prepare(`
    INSERT INTO portfolios (name, description, is_default, default_cost_basis_method, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?)
  `).run(name, description, costBasisMethod, now, now)

  return {
    id: result.lastInsertRowid as number,
    name,
    description,
    isDefault: false,
    defaultCostBasisMethod: costBasisMethod,
    createdAt: now,
    updatedAt: now
  }
}

export function updatePortfolio(id: number, updates: UpdatePortfolio): Portfolio {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT * FROM portfolios WHERE id = ?'
  ).get(id) as PortfolioRow | undefined

  if (!existing) {
    throw new Error(`Portfolio ${id} not found`)
  }

  const name = updates.name !== undefined ? updates.name.trim() : existing.name
  if (name.length === 0 || name.length > 100) {
    throw new Error('Portfolio name must be between 1 and 100 characters')
  }

  if (updates.name !== undefined && updates.name.trim() !== existing.name) {
    const duplicate = db.prepare(
      'SELECT id FROM portfolios WHERE name = ? AND id != ?'
    ).get(name, id) as { id: number } | undefined

    if (duplicate) {
      throw new Error(`Portfolio "${name}" already exists`)
    }
  }

  const description = updates.description !== undefined ? (updates.description?.trim() ?? null) : existing.description
  const costBasisMethod = updates.defaultCostBasisMethod ?? existing.default_cost_basis_method

  const validMethods: ReadonlyArray<string> = ['FIFO', 'LIFO', 'AVGCOST', 'SPECIFIC']
  if (!validMethods.includes(costBasisMethod)) {
    throw new Error(`Invalid cost basis method: ${costBasisMethod}`)
  }

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE portfolios SET name = ?, description = ?, default_cost_basis_method = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, costBasisMethod, now, id)

  return {
    id,
    name,
    description,
    isDefault: existing.is_default === 1,
    defaultCostBasisMethod: costBasisMethod as CostBasisMethod,
    createdAt: existing.created_at,
    updatedAt: now
  }
}

export function deletePortfolio(id: number): void {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT * FROM portfolios WHERE id = ?'
  ).get(id) as PortfolioRow | undefined

  if (!existing) {
    throw new Error(`Portfolio ${id} not found`)
  }

  if (existing.is_default === 1) {
    throw new Error('Cannot delete the default portfolio')
  }

  db.transaction(() => {
    // Delete lot assignments for transactions in this portfolio
    db.prepare(`
      DELETE FROM lot_assignments WHERE sell_transaction_id IN (
        SELECT id FROM transactions WHERE portfolio_id = ?
      )
    `).run(id)

    db.prepare(`
      DELETE FROM lot_assignments WHERE tax_lot_id IN (
        SELECT tl.id FROM tax_lots tl
        JOIN transactions t ON tl.transaction_id = t.id
        WHERE t.portfolio_id = ?
      )
    `).run(id)

    // Delete tax lots for transactions in this portfolio
    db.prepare(`
      DELETE FROM tax_lots WHERE transaction_id IN (
        SELECT id FROM transactions WHERE portfolio_id = ?
      )
    `).run(id)

    // Delete dividends in this portfolio
    db.prepare('DELETE FROM dividends WHERE portfolio_id = ?').run(id)

    // Delete transactions in this portfolio
    db.prepare('DELETE FROM transactions WHERE portfolio_id = ?').run(id)

    // Delete the portfolio
    db.prepare('DELETE FROM portfolios WHERE id = ?').run(id)
  })()
}
