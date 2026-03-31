// TypeScript interfaces — will be fully implemented in Task 3

export interface ElectronAPI {
  getTransactions: (filters?: TransactionFilters) => Promise<Transaction[]>
  addTransaction: (tx: NewTransaction) => Promise<Transaction>
  updateTransaction: (id: string, updates: Partial<NewTransaction>) => Promise<Transaction>
  deleteTransaction: (id: string) => Promise<void>
  getQuote: (ticker: string) => Promise<Quote>
  getQuotes: (tickers: string[]) => Promise<Quote[]>
  getHistoricalPrices: (ticker: string, from: string, to: string) => Promise<PricePoint[]>
  searchTicker: (query: string) => Promise<SearchResult[]>
  getPositions: () => Promise<Position[]>
  getPortfolioSummary: () => Promise<PortfolioSummary>
}

export type TransactionType = 'BUY' | 'SELL'

export interface Transaction {
  readonly id: string
  readonly ticker: string
  readonly type: TransactionType
  readonly shares: number
  readonly price: number
  readonly date: string
  readonly fees: number
  readonly notes: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface NewTransaction {
  readonly ticker: string
  readonly type: TransactionType
  readonly shares: number
  readonly price: number
  readonly date: string
  readonly fees?: number
  readonly notes?: string
}

export type PositionStatus = 'OPEN' | 'CLOSED'

export interface Position {
  readonly ticker: string
  readonly companyName: string
  readonly totalShares: number
  readonly costBasis: number
  readonly totalInvested: number
  readonly totalRealized: number
  readonly status: PositionStatus
  readonly color: string
}

export interface Quote {
  readonly ticker: string
  readonly price: number
  readonly previousClose: number
  readonly dayChange: number
  readonly dayChangePercent: number
  readonly companyName: string
  readonly sector: string | null
  readonly marketCap: number | null
  readonly isStale?: boolean
  readonly offline?: boolean
}

export interface PricePoint {
  readonly date: string
  readonly open: number
  readonly high: number
  readonly low: number
  readonly close: number
  readonly volume: number
}

export interface SearchResult {
  readonly ticker: string
  readonly name: string
  readonly exchange: string
  readonly type: string
}

export interface PortfolioSummary {
  readonly totalValue: number
  readonly totalCost: number
  readonly totalDayChange: number
  readonly totalDayChangePercent: number
  readonly totalUnrealizedGain: number
  readonly totalUnrealizedGainPercent: number
  readonly totalRealizedGain: number
  readonly positionCount: number
}

export interface TransactionFilters {
  readonly ticker?: string
  readonly type?: TransactionType
  readonly fromDate?: string
  readonly toDate?: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
