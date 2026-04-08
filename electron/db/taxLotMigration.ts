import { getDatabase } from './database'
import { createTaxLot, assignLotsForSell, getCostBasisMethod } from './taxLots'
import type { Transaction } from '../../src/types/index'

export function runTaxLotBackfill(): void {
  const db = getDatabase()

  const lotCount = db.prepare('SELECT COUNT(*) as count FROM tax_lots').get() as { count: number }
  const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number }

  if (lotCount.count > 0 || txCount.count === 0) {
    return
  }

  const tickers = db.prepare(
    'SELECT DISTINCT ticker FROM transactions ORDER BY ticker'
  ).all() as ReadonlyArray<{ ticker: string }>

  db.transaction(() => {
    for (const { ticker } of tickers) {
      const transactions = db.prepare(
        'SELECT * FROM transactions WHERE ticker = ? ORDER BY date ASC, created_at ASC'
      ).all(ticker) as Transaction[]

      const method = getCostBasisMethod(ticker)

      for (const tx of transactions) {
        if (tx.type === 'BUY') {
          createTaxLot(tx)
        } else {
          assignLotsForSell(tx, method)
        }
      }
    }
  })()
}
