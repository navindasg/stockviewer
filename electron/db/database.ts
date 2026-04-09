import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

function getDbPath(): string {
  return join(app.getPath('userData'), 'stock-viewer.db')
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      shares REAL NOT NULL CHECK(shares > 0),
      price REAL NOT NULL CHECK(price > 0),
      date TEXT NOT NULL,
      fees REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(ticker);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

    CREATE TABLE IF NOT EXISTS price_cache (
      ticker TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL NOT NULL,
      volume INTEGER,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (ticker, date)
    );

    CREATE TABLE IF NOT EXISTS ticker_metadata (
      ticker TEXT PRIMARY KEY,
      company_name TEXT,
      sector TEXT,
      industry TEXT,
      color TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_watchlist_ticker ON watchlist(ticker);
    CREATE INDEX IF NOT EXISTS idx_watchlist_sort_order ON watchlist(sort_order);

    CREATE TABLE IF NOT EXISTS tax_lots (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      ticker TEXT NOT NULL,
      acquisition_date TEXT NOT NULL,
      shares REAL NOT NULL CHECK(shares > 0),
      cost_per_share REAL NOT NULL CHECK(cost_per_share > 0),
      remaining_shares REAL NOT NULL CHECK(remaining_shares >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tax_lots_ticker ON tax_lots(ticker);
    CREATE INDEX IF NOT EXISTS idx_tax_lots_transaction_id ON tax_lots(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_tax_lots_remaining ON tax_lots(ticker, remaining_shares);

    CREATE TABLE IF NOT EXISTS lot_assignments (
      id TEXT PRIMARY KEY,
      sell_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      tax_lot_id TEXT NOT NULL REFERENCES tax_lots(id) ON DELETE CASCADE,
      shares_consumed REAL NOT NULL CHECK(shares_consumed > 0),
      cost_per_share REAL NOT NULL,
      proceeds_per_share REAL NOT NULL,
      realized_gain REAL NOT NULL,
      is_short_term INTEGER NOT NULL DEFAULT 0,
      is_wash_sale INTEGER NOT NULL DEFAULT 0,
      wash_sale_adjustment REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lot_assignments_sell_tx ON lot_assignments(sell_transaction_id);
    CREATE INDEX IF NOT EXISTS idx_lot_assignments_lot ON lot_assignments(tax_lot_id);

    CREATE TABLE IF NOT EXISTS dividends (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      ex_date TEXT NOT NULL,
      pay_date TEXT NOT NULL,
      amount_per_share REAL NOT NULL CHECK(amount_per_share > 0),
      total_amount REAL NOT NULL CHECK(total_amount > 0),
      shares_at_date REAL NOT NULL CHECK(shares_at_date > 0),
      type TEXT NOT NULL CHECK(type IN ('CASH', 'REINVESTED')),
      linked_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker);
    CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_date);
    CREATE INDEX IF NOT EXISTS idx_dividends_pay_date ON dividends(pay_date);
    CREATE INDEX IF NOT EXISTS idx_dividends_type ON dividends(type);
  `)

  addColumnIfNotExists(database, 'ticker_metadata', 'cost_basis_method', "TEXT NOT NULL DEFAULT 'AVGCOST'")

  // Options trading columns on transactions table
  addColumnIfNotExists(database, 'transactions', 'asset_type', "TEXT NOT NULL DEFAULT 'EQUITY'")
  addColumnIfNotExists(database, 'transactions', 'option_type', 'TEXT')
  addColumnIfNotExists(database, 'transactions', 'strike_price', 'REAL')
  addColumnIfNotExists(database, 'transactions', 'expiration_date', 'TEXT')
  addColumnIfNotExists(database, 'transactions', 'contract_multiplier', 'INTEGER')
  addColumnIfNotExists(database, 'transactions', 'option_action', 'TEXT')

  // Multi-portfolio support
  database.exec(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      default_cost_basis_method TEXT NOT NULL DEFAULT 'AVGCOST',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  migratePortfolios(database)
}

const ALLOWED_TABLES = new Set(['ticker_metadata', 'transactions', 'tax_lots', 'lot_assignments', 'price_cache', 'watchlist', 'dividends', 'portfolios'])
const IDENTIFIER_PATTERN = /^[a-z_]+$/
const DEFINITION_PATTERN = /^[A-Z ]+(?:\([^)]+\))?(?:\s+(?:NOT NULL|DEFAULT '[^']*'|DEFAULT \d+))*$/

function migratePortfolios(database: Database.Database): void {
  // Ensure a default portfolio exists
  const defaultPortfolio = database.prepare(
    'SELECT id FROM portfolios WHERE is_default = 1'
  ).get() as { id: number } | undefined

  if (!defaultPortfolio) {
    database.prepare(
      "INSERT INTO portfolios (name, description, is_default, default_cost_basis_method) VALUES ('Default', 'Default portfolio', 1, 'AVGCOST')"
    ).run()
  }

  // Add portfolio_id column to transactions if not present
  addColumnIfNotExists(database, 'transactions', 'portfolio_id', 'INTEGER')

  // Add portfolio_id column to dividends if not present
  addColumnIfNotExists(database, 'dividends', 'portfolio_id', 'INTEGER')

  // Backfill existing transactions and dividends with the default portfolio
  const dp = database.prepare(
    'SELECT id FROM portfolios WHERE is_default = 1'
  ).get() as { id: number }

  const unassignedTx = database.prepare(
    'SELECT COUNT(*) as count FROM transactions WHERE portfolio_id IS NULL'
  ).get() as { count: number }

  if (unassignedTx.count > 0) {
    database.prepare(
      'UPDATE transactions SET portfolio_id = ? WHERE portfolio_id IS NULL'
    ).run(dp.id)
  }

  const unassignedDiv = database.prepare(
    'SELECT COUNT(*) as count FROM dividends WHERE portfolio_id IS NULL'
  ).get() as { count: number }

  if (unassignedDiv.count > 0) {
    database.prepare(
      'UPDATE dividends SET portfolio_id = ? WHERE portfolio_id IS NULL'
    ).run(dp.id)
  }

  // Create index for portfolio_id on transactions
  database.exec('CREATE INDEX IF NOT EXISTS idx_transactions_portfolio ON transactions(portfolio_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_dividends_portfolio ON dividends(portfolio_id)')
}

function addColumnIfNotExists(database: Database.Database, table: string, column: string, definition: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Unexpected table name: ${table}`)
  }
  if (!IDENTIFIER_PATTERN.test(column)) {
    throw new Error(`Invalid column name: ${column}`)
  }
  if (!DEFINITION_PATTERN.test(definition)) {
    throw new Error(`Invalid column definition: ${definition}`)
  }

  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as ReadonlyArray<{ name: string }>
  const exists = columns.some((col) => col.name === column)
  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = getDbPath()
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
