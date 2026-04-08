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
  `)

  addColumnIfNotExists(database, 'ticker_metadata', 'cost_basis_method', "TEXT NOT NULL DEFAULT 'AVGCOST'")
}

const ALLOWED_TABLES = new Set(['ticker_metadata', 'transactions', 'tax_lots', 'lot_assignments', 'price_cache', 'watchlist'])
const IDENTIFIER_PATTERN = /^[a-z_]+$/

function addColumnIfNotExists(database: Database.Database, table: string, column: string, definition: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Unexpected table name: ${table}`)
  }
  if (!IDENTIFIER_PATTERN.test(column)) {
    throw new Error(`Invalid column name: ${column}`)
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
