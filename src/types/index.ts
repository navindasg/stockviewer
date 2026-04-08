// TypeScript interfaces

export type CostBasisMethod = 'FIFO' | 'LIFO' | 'AVGCOST' | 'SPECIFIC'

export interface TaxLot {
  readonly id: string
  readonly transactionId: string
  readonly ticker: string
  readonly acquisitionDate: string
  readonly shares: number
  readonly costPerShare: number
  readonly remainingShares: number
  readonly createdAt: string
}

export interface LotAssignment {
  readonly id: string
  readonly sellTransactionId: string
  readonly taxLotId: string
  readonly sharesConsumed: number
  readonly costPerShare: number
  readonly proceedsPerShare: number
  readonly realizedGain: number
  readonly isShortTerm: boolean
  readonly isWashSale: boolean
  readonly washSaleAdjustment: number
  readonly createdAt: string
}

export interface TaxReportRow {
  readonly ticker: string
  readonly companyName: string
  readonly description: string
  readonly dateAcquired: string
  readonly dateSold: string
  readonly proceeds: number
  readonly costBasis: number
  readonly adjustmentCode: string
  readonly adjustmentAmount: number
  readonly gainOrLoss: number
  readonly isShortTerm: boolean
  readonly isWashSale: boolean
}

export interface TaxReportSummary {
  readonly rows: ReadonlyArray<TaxReportRow>
  readonly totalShortTermGain: number
  readonly totalLongTermGain: number
  readonly totalWashSaleAdjustment: number
  readonly totalProceeds: number
  readonly totalCostBasis: number
  readonly totalGainOrLoss: number
}

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
  getWatchlist: () => Promise<WatchlistItem[]>
  addWatchlistItem: (item: NewWatchlistItem) => Promise<WatchlistItem>
  removeWatchlistItem: (id: string) => Promise<void>
  updateWatchlistItem: (id: string, updates: { notes?: string | null }) => Promise<WatchlistItem>
  reorderWatchlist: (orderedIds: string[]) => Promise<void>
  getTaxLots: (ticker: string) => Promise<TaxLot[]>
  getLotAssignments: (sellTransactionId: string) => Promise<LotAssignment[]>
  getAvailableLots: (ticker: string) => Promise<TaxLot[]>
  setCostBasisMethod: (ticker: string, method: CostBasisMethod) => Promise<void>
  getCostBasisMethod: (ticker: string) => Promise<CostBasisMethod>
  generateTaxReport: (year?: number) => Promise<TaxReportSummary>
  exportTaxReportCsv: (year?: number) => Promise<string>
  addTransactionWithLots: (tx: NewTransaction, lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>) => Promise<Transaction>
  getDividends: (filters?: DividendFilters) => Promise<Dividend[]>
  addDividend: (dividend: NewDividend) => Promise<Dividend>
  updateDividend: (id: string, updates: Partial<NewDividend>) => Promise<Dividend>
  deleteDividend: (id: string) => Promise<void>
  getDividendSummary: () => Promise<PortfolioDividendSummary>
  getDividendHistory: (ticker: string, from?: string) => Promise<DividendHistoryEntry[]>
  getDividendInfo: (ticker: string) => Promise<DividendInfo>
}

export type TransactionType = 'BUY' | 'SELL'
export type DividendType = 'CASH' | 'REINVESTED'

export interface Dividend {
  readonly id: string
  readonly ticker: string
  readonly exDate: string
  readonly payDate: string
  readonly amountPerShare: number
  readonly totalAmount: number
  readonly sharesAtDate: number
  readonly type: DividendType
  readonly linkedTransactionId: string | null
  readonly notes: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface NewDividend {
  readonly ticker: string
  readonly exDate: string
  readonly payDate: string
  readonly amountPerShare: number
  readonly sharesAtDate: number
  readonly type: DividendType
  readonly notes?: string
}

export interface DividendSummary {
  readonly ticker: string
  readonly companyName: string
  readonly totalIncome: number
  readonly ytdIncome: number
  readonly trailing12mIncome: number
  readonly paymentCount: number
  readonly lastPayDate: string | null
  readonly annualizedIncome: number
  readonly dividendYield: number
}

export interface PortfolioDividendSummary {
  readonly totalIncomeAllTime: number
  readonly totalIncomeYtd: number
  readonly totalIncomeTrailing12m: number
  readonly totalAnnualizedIncome: number
  readonly averageYield: number
  readonly perTicker: ReadonlyArray<DividendSummary>
}

export interface DividendInfo {
  readonly dividendRate: number | null
  readonly dividendYield: number | null
  readonly exDividendDate: string | null
  readonly fiveYearAvgDividendYield: number | null
  readonly payoutRatio: number | null
  readonly trailingAnnualDividendRate: number | null
  readonly trailingAnnualDividendYield: number | null
}

export interface DividendHistoryEntry {
  readonly date: string
  readonly amount: number
}

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
  readonly shortTermGain: number
  readonly longTermGain: number
  readonly costBasisMethod: CostBasisMethod
  readonly status: PositionStatus
  readonly color: string
  readonly firstBuyDate: string | null
  readonly lastSellDate: string | null
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
  readonly totalDividendIncome: number
  readonly totalReturn: number
  readonly totalReturnPercent: number
  readonly positionCount: number
}

export interface TransactionFilters {
  readonly ticker?: string
  readonly type?: TransactionType
  readonly fromDate?: string
  readonly toDate?: string
}

export interface WatchlistItem {
  readonly id: string
  readonly ticker: string
  readonly companyName: string
  readonly notes: string | null
  readonly sortOrder: number
  readonly addedAt: string
  readonly updatedAt: string
}

export interface NewWatchlistItem {
  readonly ticker: string
  readonly companyName: string
  readonly notes?: string
}

export interface DividendFilters {
  readonly ticker?: string
  readonly fromDate?: string
  readonly toDate?: string
  readonly type?: DividendType
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
