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
import {
  addDividend,
  getDividends,
  updateDividend,
  deleteDividend,
  getDividendSummary
} from './db/dividends'
import type { NewTransaction, TransactionFilters, CostBasisMethod, NewDividend, DividendFilters, OptionPositionFilters } from '../src/types/index'
import type { OptionAction, OptionType, NewOptionTransaction } from '../src/types/options'
import { getQuote, getQuotes, getHistoricalPrices, searchTicker, isQuoteStale, getCachedQuote, getDividendHistory, getDividendInfo, getOptionsChain } from './marketData'
import {
  addOptionTransaction,
  deleteOptionTransaction,
  getOptionTransactions,
  getOptionPositions
} from './db/options'
import {
  computePortfolioTWR,
  computeBenchmarkTWR,
  computeBenchmarkStats
} from './db/benchmarks'
import {
  listPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  deletePortfolio
} from './db/portfolios'
import type { NewPortfolio, UpdatePortfolio } from '../src/types/index'

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

function validateDividendInput(input: unknown): void {
  if (!input || typeof input !== 'object') throw new Error('Invalid input')
  const { ticker, exDate, payDate, amountPerShare, sharesAtDate, type } = input as Record<string, unknown>
  if (typeof ticker !== 'string' || ticker.length === 0 || ticker.length > 10) throw new Error('Invalid ticker')
  if (typeof exDate !== 'string' || exDate.length === 0) throw new Error('Invalid ex-date')
  if (typeof payDate !== 'string' || payDate.length === 0) throw new Error('Invalid pay date')
  if (typeof amountPerShare !== 'number' || amountPerShare <= 0) throw new Error('Invalid amount per share')
  if (typeof sharesAtDate !== 'number' || sharesAtDate <= 0) throw new Error('Invalid shares')
  if (type !== 'CASH' && type !== 'REINVESTED') throw new Error('Invalid dividend type')
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

  ipcMain.handle('db:getTransactions', (_event, filters?: unknown) => {
    if (filters !== undefined) {
      if (typeof filters !== 'object' || filters === null) throw new Error('Invalid filters')
      const f = filters as Record<string, unknown>
      if (f.ticker !== undefined && (typeof f.ticker !== 'string' || f.ticker.length === 0)) throw new Error('Invalid ticker filter')
      if (f.type !== undefined && f.type !== 'BUY' && f.type !== 'SELL') throw new Error('Invalid type filter')
      if (f.fromDate !== undefined && typeof f.fromDate !== 'string') throw new Error('Invalid fromDate filter')
      if (f.toDate !== undefined && typeof f.toDate !== 'string') throw new Error('Invalid toDate filter')
      if (f.portfolioId !== undefined && typeof f.portfolioId !== 'number') throw new Error('Invalid portfolio ID filter')
    }
    return getTransactions(filters as TransactionFilters | undefined)
  })

  ipcMain.handle('db:getPositions', (_event, portfolioId?: unknown) => {
    if (portfolioId !== undefined && typeof portfolioId !== 'number') throw new Error('Invalid portfolio ID')
    return getPositions(portfolioId as number | undefined)
  })

  ipcMain.handle('db:getPortfolioSummary', () => {
    return {
      totalValue: 0,
      totalCost: 0,
      totalDayChange: 0,
      totalDayChangePercent: 0,
      totalUnrealizedGain: 0,
      totalUnrealizedGainPercent: 0,
      totalRealizedGain: 0,
      totalDividendIncome: 0,
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

  ipcMain.handle('db:getDividends', (_event, filters?: unknown) => {
    if (filters !== undefined) {
      if (typeof filters !== 'object' || filters === null) throw new Error('Invalid filters')
      const f = filters as Record<string, unknown>
      if (f.ticker !== undefined && (typeof f.ticker !== 'string' || f.ticker.length === 0)) throw new Error('Invalid ticker filter')
      if (f.type !== undefined && f.type !== 'CASH' && f.type !== 'REINVESTED') throw new Error('Invalid type filter')
      if (f.fromDate !== undefined && typeof f.fromDate !== 'string') throw new Error('Invalid fromDate filter')
      if (f.toDate !== undefined && typeof f.toDate !== 'string') throw new Error('Invalid toDate filter')
    }
    return getDividends(filters as DividendFilters | undefined)
  })

  ipcMain.handle('db:addDividend', (_event, input: unknown) => {
    validateDividendInput(input)
    return addDividend(input as NewDividend)
  })

  ipcMain.handle('db:updateDividend', (_event, id: unknown, updates: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    if (!updates || typeof updates !== 'object') throw new Error('Invalid updates')
    const u = updates as Record<string, unknown>
    if (u.ticker !== undefined && (typeof u.ticker !== 'string' || u.ticker.length === 0 || u.ticker.length > 10)) throw new Error('Invalid ticker')
    if (u.amountPerShare !== undefined && (typeof u.amountPerShare !== 'number' || u.amountPerShare <= 0)) throw new Error('Invalid amount per share')
    if (u.sharesAtDate !== undefined && (typeof u.sharesAtDate !== 'number' || u.sharesAtDate <= 0)) throw new Error('Invalid shares')
    if (u.type !== undefined && u.type !== 'CASH' && u.type !== 'REINVESTED') throw new Error('Invalid dividend type')
    if (u.exDate !== undefined && (typeof u.exDate !== 'string' || u.exDate.length === 0)) throw new Error('Invalid ex-date')
    if (u.payDate !== undefined && (typeof u.payDate !== 'string' || u.payDate.length === 0)) throw new Error('Invalid pay date')
    return updateDividend(id, updates as Partial<NewDividend>)
  })

  ipcMain.handle('db:deleteDividend', (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    deleteDividend(id)
  })

  ipcMain.handle('db:getDividendSummary', (_event, portfolioId?: unknown) => {
    if (portfolioId !== undefined && typeof portfolioId !== 'number') throw new Error('Invalid portfolio ID')
    return getDividendSummary(portfolioId as number | undefined)
  })

  ipcMain.handle('market:getDividendHistory', async (_event, ticker: string, from?: string) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    if (from !== undefined && typeof from !== 'string') throw new Error('Invalid from date')
    return getDividendHistory(ticker, from)
  })

  ipcMain.handle('market:getDividendInfo', async (_event, ticker: string) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    return getDividendInfo(ticker)
  })

  // Benchmarking IPC Handlers
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

  function validateDateRange(from: unknown, to: unknown): asserts from is string {
    if (typeof from !== 'string' || !DATE_REGEX.test(from)) throw new Error('Invalid from date')
    if (typeof to !== 'string' || !DATE_REGEX.test(to)) throw new Error('Invalid to date')
  }

  function validateBenchmarkTicker(ticker: unknown): asserts ticker is string {
    if (typeof ticker !== 'string' || ticker.length === 0 || ticker.length > 10) throw new Error('Invalid ticker')
  }

  ipcMain.handle('db:getPortfolioTWR', async (_event, from: unknown, to: unknown, portfolioId?: unknown) => {
    validateDateRange(from, to)
    if (portfolioId !== undefined && typeof portfolioId !== 'number') throw new Error('Invalid portfolio ID')
    return computePortfolioTWR(from, to as string, portfolioId as number | undefined)
  })

  ipcMain.handle('db:getBenchmarkTWR', async (_event, ticker: unknown, from: unknown, to: unknown) => {
    validateBenchmarkTicker(ticker)
    validateDateRange(from, to)
    return computeBenchmarkTWR(ticker, from, to as string)
  })

  ipcMain.handle('db:getBenchmarkStats', async (_event, benchmarkTicker: unknown, from: unknown, to: unknown, portfolioId?: unknown) => {
    validateBenchmarkTicker(benchmarkTicker)
    validateDateRange(from, to)
    if (portfolioId !== undefined && typeof portfolioId !== 'number') throw new Error('Invalid portfolio ID')
    const portfolioTWR = computePortfolioTWR(from, to as string, portfolioId as number | undefined)
    const benchmarkTWR = computeBenchmarkTWR(benchmarkTicker, from, to as string)
    return computeBenchmarkStats(portfolioTWR, benchmarkTWR, from, to as string)
  })

  ipcMain.handle('db:getBenchmarkData', async (_event, benchmarkTicker: unknown, from: unknown, to: unknown, portfolioId?: unknown) => {
    validateBenchmarkTicker(benchmarkTicker)
    validateDateRange(from, to)
    if (portfolioId !== undefined && typeof portfolioId !== 'number') throw new Error('Invalid portfolio ID')
    const portfolioTWR = computePortfolioTWR(from, to as string, portfolioId as number | undefined)
    const benchmarkTWR = computeBenchmarkTWR(benchmarkTicker, from, to as string)
    const stats = computeBenchmarkStats(portfolioTWR, benchmarkTWR, from, to as string)
    return { portfolioTWR, benchmarkTWR, stats }
  })

  // Options Trading IPC Handlers
  ipcMain.handle('db:addOptionTransaction', (_event, tx: unknown) => {
    validateOptionTransactionInput(tx)
    return addOptionTransaction(tx as NewOptionTransaction)
  })

  ipcMain.handle('db:deleteOptionTransaction', (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error('Invalid id')
    deleteOptionTransaction(id)
  })

  ipcMain.handle('db:getOptionTransactions', (_event, filters?: unknown) => {
    if (filters !== undefined) {
      if (typeof filters !== 'object' || filters === null) throw new Error('Invalid filters')
      const f = filters as Record<string, unknown>
      if (f.ticker !== undefined && (typeof f.ticker !== 'string' || f.ticker.length === 0)) throw new Error('Invalid ticker filter')
      if (f.optionType !== undefined && f.optionType !== 'CALL' && f.optionType !== 'PUT') throw new Error('Invalid option type filter')
      if (f.status !== undefined && f.status !== 'OPEN' && f.status !== 'CLOSED' && f.status !== 'EXPIRED') throw new Error('Invalid status filter')
    }
    return getOptionTransactions(filters as OptionPositionFilters | undefined)
  })

  ipcMain.handle('db:getOptionPositions', (_event, filters?: unknown) => {
    if (filters !== undefined) {
      if (typeof filters !== 'object' || filters === null) throw new Error('Invalid filters')
      const f = filters as Record<string, unknown>
      if (f.ticker !== undefined && (typeof f.ticker !== 'string' || f.ticker.length === 0)) throw new Error('Invalid ticker filter')
      if (f.optionType !== undefined && f.optionType !== 'CALL' && f.optionType !== 'PUT') throw new Error('Invalid option type filter')
      if (f.status !== undefined && f.status !== 'OPEN' && f.status !== 'CLOSED' && f.status !== 'EXPIRED') throw new Error('Invalid status filter')
    }
    return getOptionPositions(filters as OptionPositionFilters | undefined)
  })

  ipcMain.handle('market:getOptionsChain', async (_event, ticker: string, expirationDate?: string) => {
    if (typeof ticker !== 'string' || ticker.length === 0) throw new Error('Invalid ticker')
    if (expirationDate !== undefined && typeof expirationDate !== 'string') throw new Error('Invalid expiration date')
    return getOptionsChain(ticker, expirationDate)
  })

  // Portfolio CRUD handlers
  ipcMain.handle('db:listPortfolios', () => {
    return listPortfolios()
  })

  ipcMain.handle('db:getPortfolio', (_event, id: unknown) => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw new Error('Invalid portfolio ID')
    return getPortfolio(id)
  })

  ipcMain.handle('db:createPortfolio', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid input')
    const { name, description, defaultCostBasisMethod } = input as Record<string, unknown>
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      throw new Error('Invalid portfolio name')
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      throw new Error('Invalid description')
    }
    if (defaultCostBasisMethod !== undefined) {
      const validMethods = ['FIFO', 'LIFO', 'AVGCOST', 'SPECIFIC']
      if (typeof defaultCostBasisMethod !== 'string' || !validMethods.includes(defaultCostBasisMethod)) {
        throw new Error('Invalid cost basis method')
      }
    }
    return createPortfolio(input as NewPortfolio)
  })

  ipcMain.handle('db:updatePortfolio', (_event, id: unknown, updates: unknown) => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw new Error('Invalid portfolio ID')
    if (!updates || typeof updates !== 'object') throw new Error('Invalid updates')
    const u = updates as Record<string, unknown>
    if (u.name !== undefined && (typeof u.name !== 'string' || u.name.trim().length === 0 || u.name.length > 100)) {
      throw new Error('Invalid portfolio name')
    }
    if (u.description !== undefined && u.description !== null && typeof u.description !== 'string') {
      throw new Error('Invalid description')
    }
    if (u.defaultCostBasisMethod !== undefined) {
      const validMethods = ['FIFO', 'LIFO', 'AVGCOST', 'SPECIFIC']
      if (typeof u.defaultCostBasisMethod !== 'string' || !validMethods.includes(u.defaultCostBasisMethod)) {
        throw new Error('Invalid cost basis method')
      }
    }
    return updatePortfolio(id, updates as UpdatePortfolio)
  })

  ipcMain.handle('db:deletePortfolio', (_event, id: unknown) => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw new Error('Invalid portfolio ID')
    deletePortfolio(id)
  })
}

const VALID_OPTION_ACTIONS = new Set<string>([
  'BUY_TO_OPEN', 'SELL_TO_CLOSE', 'SELL_TO_OPEN', 'BUY_TO_CLOSE', 'EXERCISE', 'ASSIGNMENT', 'EXPIRE'
])

function validateOptionTransactionInput(tx: unknown): void {
  if (!tx || typeof tx !== 'object') throw new Error('Invalid input')
  const {
    ticker, optionAction, optionType, strikePrice, expirationDate, contracts, price, date
  } = tx as Record<string, unknown>

  if (typeof ticker !== 'string' || ticker.length === 0 || ticker.length > 10) throw new Error('Invalid ticker')
  if (typeof optionAction !== 'string' || !VALID_OPTION_ACTIONS.has(optionAction)) throw new Error('Invalid option action')
  if (optionType !== 'CALL' && optionType !== 'PUT') throw new Error('Invalid option type')
  if (typeof strikePrice !== 'number' || strikePrice <= 0) throw new Error('Invalid strike price')
  if (typeof expirationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) throw new Error('Invalid expiration date format')
  if (typeof contracts !== 'number' || contracts <= 0 || !Number.isInteger(contracts)) throw new Error('Invalid contracts count')
  if (typeof price !== 'number' || price < 0) throw new Error('Invalid price')
  if (typeof date !== 'string' || date.length === 0) throw new Error('Invalid date')
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
