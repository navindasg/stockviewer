import { create } from 'zustand'
import type {
  Dividend,
  NewDividend,
  DividendFilters,
  PortfolioDividendSummary,
  DividendInfo
} from '../types/index'

interface DividendState {
  readonly dividends: ReadonlyArray<Dividend>
  readonly dividendsLoading: boolean
  readonly summary: PortfolioDividendSummary | null
  readonly summaryLoading: boolean
  readonly dividendInfo: Readonly<Record<string, DividendInfo>>
}

interface DividendActions {
  readonly fetchDividends: (filters?: DividendFilters) => Promise<void>
  readonly addDividend: (input: NewDividend) => Promise<Dividend>
  readonly updateDividend: (id: string, updates: Partial<NewDividend>) => Promise<Dividend>
  readonly deleteDividend: (id: string) => Promise<void>
  readonly fetchDividendSummary: () => Promise<void>
  readonly fetchDividendInfo: (ticker: string) => Promise<void>
}

type DividendStore = DividendState & DividendActions

export const useDividendStore = create<DividendStore>()((set, get) => ({
  dividends: [],
  dividendsLoading: false,
  summary: null,
  summaryLoading: false,
  dividendInfo: {},

  fetchDividends: async (filters?: DividendFilters) => {
    set({ dividendsLoading: true })
    try {
      const dividends = await window.electronAPI.getDividends(filters) as Dividend[]
      set({ dividends, dividendsLoading: false })
    } catch (error) {
      set({ dividendsLoading: false })
      throw new Error(
        `Failed to fetch dividends: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  addDividend: async (input: NewDividend) => {
    try {
      const dividend = await window.electronAPI.addDividend(input) as Dividend
      await get().fetchDividends()
      await get().fetchDividendSummary()
      return dividend
    } catch (error) {
      throw new Error(
        `Failed to add dividend: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  updateDividend: async (id: string, updates: Partial<NewDividend>) => {
    try {
      const dividend = await window.electronAPI.updateDividend(id, updates) as Dividend
      await get().fetchDividends()
      await get().fetchDividendSummary()
      return dividend
    } catch (error) {
      throw new Error(
        `Failed to update dividend: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  deleteDividend: async (id: string) => {
    try {
      await window.electronAPI.deleteDividend(id)
      await get().fetchDividends()
      await get().fetchDividendSummary()
    } catch (error) {
      throw new Error(
        `Failed to delete dividend: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  fetchDividendSummary: async () => {
    set({ summaryLoading: true })
    try {
      const summary = await window.electronAPI.getDividendSummary() as PortfolioDividendSummary
      set({ summary, summaryLoading: false })
    } catch (error) {
      set({ summaryLoading: false })
      throw new Error(
        `Failed to fetch dividend summary: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  fetchDividendInfo: async (ticker: string) => {
    try {
      const info = await window.electronAPI.getDividendInfo(ticker) as DividendInfo
      const existing = get().dividendInfo
      set({ dividendInfo: { ...existing, [ticker]: info } })
    } catch {
      // Dividend info is best-effort; not all tickers pay dividends
    }
  }
}))
