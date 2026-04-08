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
  addTransactionWithLots: (tx, lotSelections) => ipcRenderer.invoke('db:addTransactionWithLots', tx, lotSelections)
}

contextBridge.exposeInMainWorld('electronAPI', api)
