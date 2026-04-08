import { create } from 'zustand'
import type { WatchlistItem, NewWatchlistItem } from '../types/index'

interface WatchlistState {
  readonly items: ReadonlyArray<WatchlistItem>
  readonly isLoading: boolean
  readonly error: string | null
}

interface WatchlistActions {
  readonly fetchWatchlist: () => Promise<void>
  readonly addItem: (item: NewWatchlistItem) => Promise<WatchlistItem>
  readonly removeItem: (id: string) => Promise<void>
  readonly updateItem: (id: string, updates: { notes?: string | null }) => Promise<void>
  readonly reorderItems: (orderedIds: ReadonlyArray<string>) => Promise<void>
  readonly clearError: () => void
}

type WatchlistStore = WatchlistState & WatchlistActions

export const useWatchlistStore = create<WatchlistStore>()((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchWatchlist: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await window.electronAPI.getWatchlist()
      set({ items, isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch watchlist'
      set({ isLoading: false, error: message })
      throw new Error(message)
    }
  },

  addItem: async (item: NewWatchlistItem) => {
    try {
      const newItem = await window.electronAPI.addWatchlistItem(item)
      set({ items: [...get().items, newItem] })
      return newItem
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add watchlist item'
      set({ error: message })
      throw new Error(message)
    }
  },

  removeItem: async (id: string) => {
    try {
      await window.electronAPI.removeWatchlistItem(id)
      set({ items: get().items.filter((item) => item.id !== id) })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove watchlist item'
      set({ error: message })
      throw new Error(message)
    }
  },

  updateItem: async (id: string, updates: { notes?: string | null }) => {
    try {
      const updated = await window.electronAPI.updateWatchlistItem(id, updates)
      set({
        items: get().items.map((item) => (item.id === id ? updated : item))
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update watchlist item'
      set({ error: message })
      throw new Error(message)
    }
  },

  reorderItems: async (orderedIds: ReadonlyArray<string>) => {
    const currentItems = get().items
    const reordered = orderedIds
      .map((id, index) => {
        const item = currentItems.find((i) => i.id === id)
        return item ? { ...item, sortOrder: index } : null
      })
      .filter((item): item is WatchlistItem => item !== null)

    set({ items: reordered })

    try {
      await window.electronAPI.reorderWatchlist([...orderedIds])
    } catch (error) {
      set({ items: currentItems })
      const message = error instanceof Error ? error.message : 'Failed to reorder watchlist'
      set({ error: message })
      throw new Error(message)
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
