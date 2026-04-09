import { create } from 'zustand'
import type { Portfolio, NewPortfolio, UpdatePortfolio } from '../types/index'

interface PortfolioState {
  readonly portfolios: ReadonlyArray<Portfolio>
  readonly portfoliosLoading: boolean
  readonly activePortfolioId: number | null
}

interface PortfolioActions {
  readonly fetchPortfolios: () => Promise<void>
  readonly setActivePortfolioId: (id: number | null) => void
  readonly createPortfolio: (input: NewPortfolio) => Promise<Portfolio>
  readonly updatePortfolio: (id: number, updates: UpdatePortfolio) => Promise<Portfolio>
  readonly deletePortfolio: (id: number) => Promise<void>
  readonly getActivePortfolio: () => Portfolio | null
}

type PortfolioStore = PortfolioState & PortfolioActions

export const usePortfolioStore = create<PortfolioStore>()((set, get) => ({
  portfolios: [],
  portfoliosLoading: false,
  activePortfolioId: null,

  fetchPortfolios: async () => {
    set({ portfoliosLoading: true })
    try {
      const portfolios = await window.electronAPI.listPortfolios() as Portfolio[]
      set({ portfolios, portfoliosLoading: false })
    } catch (error) {
      set({ portfoliosLoading: false })
      throw new Error(
        `Failed to fetch portfolios: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  setActivePortfolioId: (id: number | null) => {
    set({ activePortfolioId: id })
  },

  createPortfolio: async (input: NewPortfolio) => {
    try {
      const portfolio = await window.electronAPI.createPortfolio(input) as Portfolio
      await get().fetchPortfolios()
      return portfolio
    } catch (error) {
      throw new Error(
        `Failed to create portfolio: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  updatePortfolio: async (id: number, updates: UpdatePortfolio) => {
    try {
      const portfolio = await window.electronAPI.updatePortfolio(id, updates) as Portfolio
      await get().fetchPortfolios()
      return portfolio
    } catch (error) {
      throw new Error(
        `Failed to update portfolio: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  deletePortfolio: async (id: number) => {
    try {
      await window.electronAPI.deletePortfolio(id)
      const { activePortfolioId } = get()
      if (activePortfolioId === id) {
        set({ activePortfolioId: null })
      }
      await get().fetchPortfolios()
    } catch (error) {
      throw new Error(
        `Failed to delete portfolio: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  getActivePortfolio: () => {
    const { portfolios, activePortfolioId } = get()
    if (activePortfolioId === null) return null
    return portfolios.find((p) => p.id === activePortfolioId) ?? null
  }
}))
