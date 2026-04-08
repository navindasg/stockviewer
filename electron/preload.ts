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
  reorderWatchlist: (orderedIds) => ipcRenderer.invoke('db:reorderWatchlist', orderedIds)
}

contextBridge.exposeInMainWorld('electronAPI', api)
