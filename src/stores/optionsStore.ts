import { create } from 'zustand'
import type {
  OptionPosition,
  OptionTransaction,
  NewOptionTransaction,
  OptionPositionFilters,
  OptionsChainData,
  PortfolioGreeks
} from '../types/index'
import { usePortfolioStore } from './portfolioStore'

interface OptionsState {
  readonly optionPositions: ReadonlyArray<OptionPosition>
  readonly optionPositionsLoading: boolean
  readonly optionTransactions: ReadonlyArray<OptionTransaction>
  readonly optionsChain: OptionsChainData | null
  readonly optionsChainLoading: boolean
  readonly optionModalOpen: boolean
  readonly portfolioGreeks: PortfolioGreeks
}

interface OptionsActions {
  readonly fetchOptionPositions: (filters?: OptionPositionFilters) => Promise<void>
  readonly fetchOptionTransactions: (filters?: OptionPositionFilters) => Promise<void>
  readonly addOptionTransaction: (tx: NewOptionTransaction) => Promise<void>
  readonly deleteOptionTransaction: (id: string) => Promise<void>
  readonly fetchOptionsChain: (ticker: string, expirationDate?: string) => Promise<void>
  readonly setOptionModalOpen: (open: boolean) => void
}

type OptionsStore = OptionsState & OptionsActions

const DEFAULT_GREEKS: PortfolioGreeks = {
  totalDelta: 0,
  totalGamma: 0,
  totalTheta: 0,
  totalVega: 0,
  positionCount: 0
}

export const useOptionsStore = create<OptionsStore>()((set, get) => ({
  optionPositions: [],
  optionPositionsLoading: false,
  optionTransactions: [],
  optionsChain: null,
  optionsChainLoading: false,
  optionModalOpen: false,
  portfolioGreeks: { ...DEFAULT_GREEKS },

  fetchOptionPositions: async (filters?: OptionPositionFilters) => {
    set({ optionPositionsLoading: true })
    try {
      const portfolioId = usePortfolioStore.getState().activePortfolioId
      const mergedFilters: OptionPositionFilters = {
        ...filters,
        ...(portfolioId !== null ? { portfolioId } : {})
      }
      const positions = await window.electronAPI.getOptionPositions(mergedFilters) as OptionPosition[]
      set({ optionPositions: positions, optionPositionsLoading: false })
    } catch (error) {
      set({ optionPositionsLoading: false })
      throw new Error(
        `Failed to fetch option positions: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  fetchOptionTransactions: async (filters?: OptionPositionFilters) => {
    try {
      const portfolioId = usePortfolioStore.getState().activePortfolioId
      const mergedFilters: OptionPositionFilters = {
        ...filters,
        ...(portfolioId !== null ? { portfolioId } : {})
      }
      const transactions = await window.electronAPI.getOptionTransactions(mergedFilters) as OptionTransaction[]
      set({ optionTransactions: transactions })
    } catch (error) {
      throw new Error(
        `Failed to fetch option transactions: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  addOptionTransaction: async (tx: NewOptionTransaction) => {
    try {
      await window.electronAPI.addOptionTransaction(tx)
      await get().fetchOptionPositions()
    } catch (error) {
      throw new Error(
        `Failed to add option transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  deleteOptionTransaction: async (id: string) => {
    try {
      await window.electronAPI.deleteOptionTransaction(id)
      await get().fetchOptionPositions()
    } catch (error) {
      throw new Error(
        `Failed to delete option transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  fetchOptionsChain: async (ticker: string, expirationDate?: string) => {
    set({ optionsChainLoading: true })
    try {
      const chain = await window.electronAPI.getOptionsChain(ticker, expirationDate) as OptionsChainData
      set({ optionsChain: chain, optionsChainLoading: false })
    } catch (error) {
      set({ optionsChainLoading: false })
      throw new Error(
        `Failed to fetch options chain: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  setOptionModalOpen: (open: boolean) => {
    set({ optionModalOpen: open })
  }
}))
