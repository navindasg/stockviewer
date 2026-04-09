import { create } from 'zustand'
import type { Position, Quote, NewTransaction, TaxLot, CostBasisMethod, TaxReportSummary } from '../types/index'
import { usePortfolioStore } from './portfolioStore'

export type ViewName = 'dashboard' | 'position-detail' | 'compare' | 'transactions' | 'closed-positions' | 'watchlist' | 'dividends' | 'options' | 'benchmark' | 'portfolios'
export type GainStatus = 'all' | 'winners' | 'losers'

export interface FilterState {
  readonly sectors: ReadonlyArray<string>
  readonly dateFrom: string | null
  readonly dateTo: string | null
  readonly gainStatus: GainStatus
  readonly searchText: string
}

const DEFAULT_FILTERS: FilterState = {
  sectors: [],
  dateFrom: null,
  dateTo: null,
  gainStatus: 'all',
  searchText: ''
}

interface AppState {
  readonly positions: ReadonlyArray<Position>
  readonly positionsLoading: boolean
  readonly selectedTicker: string | null
  readonly quotes: Readonly<Record<string, Quote>>
  readonly quotesLastFetched: number | null
  readonly filters: FilterState
  readonly sidebarCollapsed: boolean
  readonly activeView: ViewName
  readonly modalOpen: boolean
  readonly taxLots: ReadonlyArray<TaxLot>
  readonly taxLotsLoading: boolean
  readonly taxReport: TaxReportSummary | null
}

interface AppActions {
  readonly fetchPositions: () => Promise<void>
  readonly fetchQuotes: (tickers: ReadonlyArray<string>) => Promise<void>
  readonly addTransaction: (tx: NewTransaction) => Promise<void>
  readonly addTransactionWithLots: (tx: NewTransaction, lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>) => Promise<void>
  readonly updateTransaction: (id: string, updates: Partial<NewTransaction>) => Promise<void>
  readonly deleteTransaction: (id: string) => Promise<void>
  readonly setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  readonly clearFilters: () => void
  readonly setActiveView: (view: ViewName) => void
  readonly setSelectedTicker: (ticker: string | null) => void
  readonly toggleSidebar: () => void
  readonly setModalOpen: (open: boolean) => void
  readonly fetchTaxLots: (ticker: string) => Promise<void>
  readonly setCostBasisMethod: (ticker: string, method: CostBasisMethod) => Promise<void>
  readonly fetchTaxReport: (year?: number) => Promise<void>
  readonly exportTaxReportCsv: (year?: number) => Promise<string>
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>()((set, get) => ({
  positions: [],
  positionsLoading: false,
  selectedTicker: null,
  quotes: {},
  quotesLastFetched: null,
  filters: { ...DEFAULT_FILTERS },
  sidebarCollapsed: false,
  activeView: 'dashboard',
  modalOpen: false,
  taxLots: [],
  taxLotsLoading: false,
  taxReport: null,

  fetchPositions: async () => {
    set({ positionsLoading: true })
    try {
      const portfolioId = usePortfolioStore.getState().activePortfolioId
      const positions = await window.electronAPI.getPositions(portfolioId ?? undefined)
      set({ positions, positionsLoading: false })
    } catch (error) {
      set({ positionsLoading: false })
      throw new Error(
        `Failed to fetch positions: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  fetchQuotes: async (tickers: ReadonlyArray<string>) => {
    try {
      const quotesArray = await window.electronAPI.getQuotes([...tickers])
      const existingQuotes = get().quotes
      const updatedQuotes = quotesArray.reduce<Record<string, Quote>>(
        (acc, quote) => ({ ...acc, [quote.ticker]: quote }),
        { ...existingQuotes }
      )
      set({ quotes: updatedQuotes, quotesLastFetched: Date.now() })
    } catch (error) {
      throw new Error(
        `Failed to fetch quotes: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  addTransaction: async (tx: NewTransaction) => {
    try {
      await window.electronAPI.addTransaction(tx)
      await get().fetchPositions()
    } catch (error) {
      throw new Error(
        `Failed to add transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  addTransactionWithLots: async (tx: NewTransaction, lotSelections?: ReadonlyArray<{ lotId: string; shares: number }>) => {
    try {
      await window.electronAPI.addTransactionWithLots(tx, lotSelections)
      await get().fetchPositions()
    } catch (error) {
      throw new Error(
        `Failed to add transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  updateTransaction: async (id: string, updates: Partial<NewTransaction>) => {
    try {
      await window.electronAPI.updateTransaction(id, updates)
      await get().fetchPositions()
    } catch (error) {
      throw new Error(
        `Failed to update transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  deleteTransaction: async (id: string) => {
    try {
      await window.electronAPI.deleteTransaction(id)
      await get().fetchPositions()
    } catch (error) {
      throw new Error(
        `Failed to delete transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value }
    }))
  },

  clearFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } })
  },

  setActiveView: (view: ViewName) => {
    set({ activeView: view })
  },

  setSelectedTicker: (ticker: string | null) => {
    set({ selectedTicker: ticker })
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setModalOpen: (open: boolean) => {
    set({ modalOpen: open })
  },

  fetchTaxLots: async (ticker: string) => {
    set({ taxLotsLoading: true })
    try {
      const taxLots = await window.electronAPI.getTaxLots(ticker)
      set({ taxLots, taxLotsLoading: false })
    } catch (error) {
      set({ taxLotsLoading: false })
      throw new Error(
        `Failed to fetch tax lots: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  setCostBasisMethod: async (ticker: string, method: CostBasisMethod) => {
    try {
      await window.electronAPI.setCostBasisMethod(ticker, method)
      await get().fetchPositions()
      await get().fetchTaxLots(ticker)
    } catch (error) {
      throw new Error(
        `Failed to set cost basis method: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  fetchTaxReport: async (year?: number) => {
    try {
      const taxReport = await window.electronAPI.generateTaxReport(year) as TaxReportSummary
      set({ taxReport })
    } catch (error) {
      throw new Error(
        `Failed to generate tax report: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  exportTaxReportCsv: async (year?: number) => {
    try {
      return await window.electronAPI.exportTaxReportCsv(year)
    } catch (error) {
      throw new Error(
        `Failed to export tax report: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}))
