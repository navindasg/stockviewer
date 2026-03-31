import type { Transaction, TransactionType } from '../../types/index'

export type SortColumn =
  | 'date'
  | 'ticker'
  | 'type'
  | 'shares'
  | 'price'
  | 'total'
  | 'fees'

export type SortDirection = 'asc' | 'desc'

interface FilterParams {
  readonly searchText: string
  readonly dateFrom: string | null
  readonly dateTo: string | null
  readonly tickerFilter: string
  readonly typeFilter: TransactionType | 'ALL'
}

export function filterTransactions(
  transactions: ReadonlyArray<Transaction>,
  params: FilterParams
): ReadonlyArray<Transaction> {
  const { searchText, dateFrom, dateTo, tickerFilter, typeFilter } = params

  return transactions.filter((tx) => {
    if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
      return false
    }

    if (tickerFilter && !tx.ticker.toLowerCase().includes(tickerFilter.toLowerCase())) {
      return false
    }

    if (searchText && !tx.ticker.toLowerCase().includes(searchText.toLowerCase())) {
      return false
    }

    if (dateFrom && tx.date < dateFrom) {
      return false
    }

    if (dateTo && tx.date > dateTo) {
      return false
    }

    return true
  })
}

function getTransactionTotal(tx: Transaction): number {
  return tx.shares * tx.price
}

function compareValues(a: number | string, b: number | string, direction: SortDirection): number {
  const modifier = direction === 'asc' ? 1 : -1
  if (a < b) return -1 * modifier
  if (a > b) return 1 * modifier
  return 0
}

export function sortTransactions(
  transactions: ReadonlyArray<Transaction>,
  column: SortColumn,
  direction: SortDirection
): ReadonlyArray<Transaction> {
  return [...transactions].sort((a, b) => {
    switch (column) {
      case 'date':
        return compareValues(a.date, b.date, direction)
      case 'ticker':
        return compareValues(a.ticker, b.ticker, direction)
      case 'type':
        return compareValues(a.type, b.type, direction)
      case 'shares':
        return compareValues(a.shares, b.shares, direction)
      case 'price':
        return compareValues(a.price, b.price, direction)
      case 'total':
        return compareValues(getTransactionTotal(a), getTransactionTotal(b), direction)
      case 'fees':
        return compareValues(a.fees, b.fees, direction)
      default:
        return 0
    }
  })
}

export function getUniqueTickers(transactions: ReadonlyArray<Transaction>): ReadonlyArray<string> {
  const tickers = new Set(transactions.map((tx) => tx.ticker))
  return [...tickers].sort()
}
