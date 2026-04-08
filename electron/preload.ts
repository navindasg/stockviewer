import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  getTransactions: (filters?: Record<string, unknown>) => Promise<unknown[]>
  addTransaction: (tx: Record<string, unknown>) => Promise<unknown>
  updateTransaction: (id: string, updates: Record<string, unknown>) => Promise<unknown>
  deleteTransaction: (id: string) => Promise<void>
  getQuote: (ticker: string) => Promise<unknown>
  getQuotes: (tickers: string[]) => Promise<unknown[]>
  getHistoricalPrices: (ticker: string, from: string, to: string) => Promise<unknown[]>
  searchTicker: (query: string) => Promise<unknown[]>
  getPositions: () => Promise<unknown[]>
  getPortfolioSummary: () => Promise<unknown>
  getWatchlist: () => Promise<unknown[]>
  addWatchlistItem: (item: Record<string, unknown>) => Promise<unknown>
  removeWatchlistItem: (id: string) => Promise<void>
  updateWatchlistItem: (id: string, updates: Record<string, unknown>) => Promise<unknown>
  reorderWatchlist: (orderedIds: string[]) => Promise<void>
  getTaxLots: (ticker: string) => Promise<unknown[]>
  getLotAssignments: (sellTransactionId: string) => Promise<unknown[]>
  getAvailableLots: (ticker: string) => Promise<unknown[]>
  setCostBasisMethod: (ticker: string, method: string) => Promise<void>
  getCostBasisMethod: (ticker: string) => Promise<string>
  generateTaxReport: (year?: number) => Promise<unknown>
  exportTaxReportCsv: (year?: number) => Promise<string>
  addTransactionWithLots: (tx: Record<string, unknown>, lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>) => Promise<unknown>
  getDividends: (filters?: Record<string, unknown>) => Promise<unknown[]>
  addDividend: (input: Record<string, unknown>) => Promise<unknown>
  updateDividend: (id: string, updates: Record<string, unknown>) => Promise<unknown>
  deleteDividend: (id: string) => Promise<void>
  getDividendSummary: () => Promise<unknown>
  getDividendHistory: (ticker: string, from?: string) => Promise<unknown[]>
  getDividendInfo: (ticker: string) => Promise<unknown>
  addOptionTransaction: (tx: Record<string, unknown>) => Promise<unknown>
  deleteOptionTransaction: (id: string) => Promise<void>
  getOptionTransactions: (filters?: Record<string, unknown>) => Promise<unknown[]>
  getOptionPositions: (filters?: Record<string, unknown>) => Promise<unknown[]>
  getOptionsChain: (ticker: string, expirationDate?: string) => Promise<unknown>
}

const api: ElectronAPI = {
  getTransactions: (filters) => ipcRenderer.invoke('db:getTransactions', filters),
  addTransaction: (tx) => ipcRenderer.invoke('db:addTransaction', tx),
  updateTransaction: (id, updates) => ipcRenderer.invoke('db:updateTransaction', id, updates),
  deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
  getQuote: (ticker) => ipcRenderer.invoke('market:getQuote', ticker),
  getQuotes: (tickers) => ipcRenderer.invoke('market:getQuotes', tickers),
  getHistoricalPrices: (ticker, from, to) =>
    ipcRenderer.invoke('market:getHistoricalPrices', ticker, from, to),
  searchTicker: (query) => ipcRenderer.invoke('market:searchTicker', query),
  getPositions: () => ipcRenderer.invoke('db:getPositions'),
  getPortfolioSummary: () => ipcRenderer.invoke('db:getPortfolioSummary'),
  getWatchlist: () => ipcRenderer.invoke('db:getWatchlist'),
  addWatchlistItem: (item) => ipcRenderer.invoke('db:addWatchlistItem', item),
  removeWatchlistItem: (id) => ipcRenderer.invoke('db:removeWatchlistItem', id),
  updateWatchlistItem: (id, updates) => ipcRenderer.invoke('db:updateWatchlistItem', id, updates),
  reorderWatchlist: (orderedIds) => ipcRenderer.invoke('db:reorderWatchlist', orderedIds),
  getTaxLots: (ticker) => ipcRenderer.invoke('db:getTaxLots', ticker),
  getLotAssignments: (sellTransactionId) => ipcRenderer.invoke('db:getLotAssignments', sellTransactionId),
  getAvailableLots: (ticker) => ipcRenderer.invoke('db:getAvailableLots', ticker),
  setCostBasisMethod: (ticker, method) => ipcRenderer.invoke('db:setCostBasisMethod', ticker, method),
  getCostBasisMethod: (ticker) => ipcRenderer.invoke('db:getCostBasisMethod', ticker),
  generateTaxReport: (year) => ipcRenderer.invoke('db:generateTaxReport', year),
  exportTaxReportCsv: (year) => ipcRenderer.invoke('db:exportTaxReportCsv', year),
  addTransactionWithLots: (tx, lotSelections) => ipcRenderer.invoke('db:addTransactionWithLots', tx, lotSelections),
  getDividends: (filters) => ipcRenderer.invoke('db:getDividends', filters),
  addDividend: (input) => ipcRenderer.invoke('db:addDividend', input),
  updateDividend: (id, updates) => ipcRenderer.invoke('db:updateDividend', id, updates),
  deleteDividend: (id) => ipcRenderer.invoke('db:deleteDividend', id),
  getDividendSummary: () => ipcRenderer.invoke('db:getDividendSummary'),
  getDividendHistory: (ticker, from) => ipcRenderer.invoke('market:getDividendHistory', ticker, from),
  getDividendInfo: (ticker) => ipcRenderer.invoke('market:getDividendInfo', ticker),
  getPortfolioTWR: (from, to) => ipcRenderer.invoke('db:getPortfolioTWR', from, to),
  getBenchmarkTWR: (ticker, from, to) => ipcRenderer.invoke('db:getBenchmarkTWR', ticker, from, to),
  getBenchmarkStats: (benchmarkTicker, from, to) => ipcRenderer.invoke('db:getBenchmarkStats', benchmarkTicker, from, to),
  getBenchmarkData: (benchmarkTicker, from, to) => ipcRenderer.invoke('db:getBenchmarkData', benchmarkTicker, from, to),
  addOptionTransaction: (tx) => ipcRenderer.invoke('db:addOptionTransaction', tx),
  deleteOptionTransaction: (id) => ipcRenderer.invoke('db:deleteOptionTransaction', id),
  getOptionTransactions: (filters) => ipcRenderer.invoke('db:getOptionTransactions', filters),
  getOptionPositions: (filters) => ipcRenderer.invoke('db:getOptionPositions', filters),
  getOptionsChain: (ticker, expirationDate) => ipcRenderer.invoke('market:getOptionsChain', ticker, expirationDate)
}

contextBridge.exposeInMainWorld('electronAPI', api)
