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
  `)
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
