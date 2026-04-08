import { app, BrowserWindow, ipcMain, session, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { initDatabase, closeDatabase } from './db/database'
import { addTransaction, updateTransaction, deleteTransaction, getTransactions, getPositions } from './db/positions'
import {
  getWatchlistItems,
  addWatchlistItem,
  removeWatchlistItem,
  updateWatchlistItem,
  reorderWatchlistItems
} from './db/watchlist'
import {
  getTaxLots,
  getLotAssignments,
  getAvailableLots,
  setCostBasisMethod,
  getCostBasisMethod,
  recomputeLotsForTicker
} from './db/taxLots'
import { runTaxLotBackfill } from './db/taxLotMigration'
import { generateTaxReport, generateTaxReportCsv } from './db/taxReport'
import type { NewTransaction, TransactionFilters, CostBasisMethod } from '../src/types/index'
import { getQuote, getQuotes, getHistoricalPrices, searchTicker, isQuoteStale, getCachedQuote } from './marketData'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0A0E17',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function validateTransactionInput(tx: unknown): void {
  if (!tx || typeof tx !== 'object') throw new Error('Invalid input')
  const { ticker, type, shares, price, date } = tx as Record<string, unknown>
  if (typeof ticker !== 'string' || ticker.length === 0 || ticker.length > 10) throw new Error('Invalid ticker')
  if (type !== 'BUY' && type !== 'SELL') throw new Error('Invalid type')
  if (typeof shares !== 'number' || shares <= 0) throw new Error('Invalid shares')
  if (typeof price !== 'number' || price <= 0) throw new Error('Invalid price')
  if (typeof date !== 'string' || date.length === 0) throw new Error('Invalid date')
}

function registerIpcHandlers(): void {
  ipcMain.handle('db:addTransaction', (_event, tx: unknown) => {
    validateTransactionInput(tx)
    return addTransaction(tx as NewTransaction)
  })

  ipcMain.handle('db:addTransactionWithLots', (_event, tx: unknown, lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>) => {
    validateTransactionInput(tx)
    if (lotSelections !== undefined) {
      if (!Array.isArray(lotSelections)) throw new Error('Invalid lot selections')
      for (const sel of lotSelections) {
        if (!sel || typeof sel !== 'object') throw new Error('Invalid lot selection')
        if (typeof sel.lotId !== 'string' || sel.lotId.length === 0) throw new Error('Invalid lot ID')
        if (typeof sel.shares !== 'number' || sel.shares <= 0) throw new Error('Invalid lot shares')
      }
    }
    return addTransaction(tx as NewTransaction, lotSelections)
  })

  ipcMain.handle('db:updateTransaction', (_event, id: unknown, updates: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    if (!updates || typeof updates !== 'object') throw new Error('Invalid updates')
    return updateTransaction(id, updates as Partial<NewTransaction>)
  })

  ipcMain.handle('db:deleteTransaction', (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    deleteTransaction(id)
  })

  ipcMain.handle('db:getTransactions', (_event, filters?: TransactionFilters) => {
    return getTransactions(filters)
  })

  ipcMain.handle('db:getPositions', () => {
    return getPositions()
  })

  ipcMain.handle('db:getPortfolioSummary', () => {
    // Stub — full implementation in Task 5 (Zustand store) with market data
    return {
      totalValue: 0,
      totalCost: 0,
      totalDayChange: 0,
      totalDayChangePercent: 0,
      totalUnrealizedGain: 0,
      totalUnrealizedGainPercent: 0,
      totalRealizedGain: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      positionCount: 0
    }
  })

  ipcMain.handle('market:getQuote', async (_event, ticker: string) => {
    try {
      const quote = await getQuote(ticker)
      return { ...quote, isStale: isQuoteStale(ticker) }
    } catch {
      const cached = getCachedQuote(ticker)
      if (cached) {
        return { ...cached, offline: true, isStale: true }
      }
      throw new Error(`Unable to fetch quote for ${ticker}`)
    }
  })

  ipcMain.handle('market:getQuotes', async (_event, tickers: string[]) => {
    try {
      return await getQuotes(tickers)
    } catch {
      return tickers
        .map((t) => getCachedQuote(t))
        .filter((q): q is NonNullable<typeof q> => q !== null)
        .map((q) => ({ ...q, offline: true, isStale: true }))
    }
  })

  ipcMain.handle('market:getHistoricalPrices', async (_event, ticker: string, from: string, to: string) => {
    return getHistoricalPrices(ticker, from, to)
  })

  ipcMain.handle('market:searchTicker', async (_event, query: string) => {
    return searchTicker(query)
  })

  ipcMain.handle('db:getTaxLots', (_event, ticker: string) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    return getTaxLots(ticker.toUpperCase())
  })

  ipcMain.handle('db:getLotAssignments', (_event, sellTransactionId: string) => {
    if (typeof sellTransactionId !== 'string' || sellTransactionId.length === 0) throw new Error('Invalid transaction ID')
    return getLotAssignments(sellTransactionId)
  })

  ipcMain.handle('db:getAvailableLots', (_event, ticker: string) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    return getAvailableLots(ticker.toUpperCase())
  })

  ipcMain.handle('db:setCostBasisMethod', (_event, ticker: string, method: CostBasisMethod) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    const validMethods = ['FIFO', 'LIFO', 'AVGCOST', 'SPECIFIC']
    if (!validMethods.includes(method)) throw new Error('Invalid cost basis method')
    setCostBasisMethod(ticker.toUpperCase(), method)
    recomputeLotsForTicker(ticker.toUpperCase())
  })

  ipcMain.handle('db:getCostBasisMethod', (_event, ticker: string) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    return getCostBasisMethod(ticker.toUpperCase())
  })

  ipcMain.handle('db:generateTaxReport', (_event, year?: number) => {
    if (year !== undefined && (typeof year !== 'number' || year < 1900 || year > 2100)) {
      throw new Error('Invalid year')
    }
    return generateTaxReport(year)
  })

  ipcMain.handle('db:exportTaxReportCsv', async (_event, year?: number) => {
    if (year !== undefined && (typeof year !== 'number' || year < 1900 || year > 2100)) {
      throw new Error('Invalid year')
    }
    const csv = generateTaxReportCsv(year)
    const yearLabel = year ?? 'all-years'
    const result = await dialog.showSaveDialog({
      title: 'Export Tax Report',
      defaultPath: `tax-report-${yearLabel}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) {
      return ''
    }
    writeFileSync(result.filePath, csv, 'utf-8')
    return result.filePath
  })

  ipcMain.handle('db:getWatchlist', () => {
    const rows = getWatchlistItems()
    return rows.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      companyName: row.company_name,
      notes: row.notes,
      sortOrder: row.sort_order,
      addedAt: row.added_at,
      updatedAt: row.updated_at
    }))
  })

  ipcMain.handle('db:addWatchlistItem', (_event, item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid input')
    const { ticker, companyName, notes } = item as Record<string, unknown>
    if (typeof ticker !== 'string' || ticker.length === 0 || ticker.length > 10) {
      throw new Error('Invalid ticker')
    }
    if (typeof companyName !== 'string' || companyName.length === 0 || companyName.length > 200) {
      throw new Error('Invalid company name')
    }
    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      throw new Error('Invalid notes')
    }
    const sanitizedNotes = typeof notes === 'string' ? notes.substring(0, 1000) : undefined
    const row = addWatchlistItem(ticker, companyName, sanitizedNotes)
    return {
      id: row.id,
      ticker: row.ticker,
      companyName: row.company_name,
      notes: row.notes,
      sortOrder: row.sort_order,
      addedAt: row.added_at,
      updatedAt: row.updated_at
    }
  })

  ipcMain.handle('db:removeWatchlistItem', (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    removeWatchlistItem(id)
  })

  ipcMain.handle('db:updateWatchlistItem', (_event, id: unknown, updates: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    if (!updates || typeof updates !== 'object') throw new Error('Invalid updates')
    const { notes } = updates as Record<string, unknown>
    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      throw new Error('Invalid notes')
    }
    const sanitizedNotes = typeof notes === 'string' ? notes.substring(0, 1000) : (notes as null | undefined)
    const row = updateWatchlistItem(id, { notes: sanitizedNotes })
    return {
      id: row.id,
      ticker: row.ticker,
      companyName: row.company_name,
      notes: row.notes,
      sortOrder: row.sort_order,
      addedAt: row.added_at,
      updatedAt: row.updated_at
    }
  })

  ipcMain.handle('db:reorderWatchlist', (_event, orderedIds: unknown) => {
    if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string')) {
      throw new Error('Invalid ordered IDs')
    }
    reorderWatchlistItems(orderedIds as string[])
  })
}

app.whenReady().then(() => {
  initDatabase()
  runTaxLotBackfill()
  registerIpcHandlers()

  session.defaultSession.webRequest.onHeadersReceived((_details, callback) => {
    callback({
      responseHeaders: {
        ...(_details.responseHeaders ?? {}),
        'Content-Security-Policy': [
          process.env.ELECTRON_RENDERER_URL
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com"
        ]
      }
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
