import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWatchlistStore } from '../../stores/watchlistStore'
import { useAppStore } from '../../stores/appStore'
import { WatchlistTable } from './WatchlistTable'
import { AddToWatchlistModal } from './AddToWatchlistModal'
import { EditNoteModal } from './EditNoteModal'
import type { WatchlistItem } from '../../types/index'

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { readonly spinning: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={spinning ? 'animate-spin' : ''}
    >
      <path
        d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 2.5L8 2.5L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 12C14 12 6 24 6 24C6 24 14 36 24 36C34 36 42 24 42 24C42 24 34 12 24 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function WatchlistView() {
  const items = useWatchlistStore((s) => s.items)
  const isLoading = useWatchlistStore((s) => s.isLoading)
  const error = useWatchlistStore((s) => s.error)
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist)
  const addItem = useWatchlistStore((s) => s.addItem)
  const removeItem = useWatchlistStore((s) => s.removeItem)
  const updateItem = useWatchlistStore((s) => s.updateItem)
  const clearError = useWatchlistStore((s) => s.clearError)

  const quotes = useAppStore((s) => s.quotes)
  const fetchQuotes = useAppStore((s) => s.fetchQuotes)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editNoteItem, setEditNoteItem] = useState<WatchlistItem | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const existingTickers = useMemo(() => items.map((i) => i.ticker), [items])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  useEffect(() => {
    if (items.length === 0) return

    const tickers = items.map((i) => i.ticker)
    fetchQuotes(tickers).catch(() => {
      // Quotes will remain empty; sparklines still show cached data
    })
  }, [items, fetchQuotes])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchWatchlist()
      const freshItems = useWatchlistStore.getState().items
      const tickers = freshItems.map((i) => i.ticker)
      if (tickers.length > 0) {
        await fetchQuotes(tickers)
      }
    } catch {
      // Error state is managed by the store
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchWatchlist, fetchQuotes])

  const handleAdd = useCallback(async (ticker: string, companyName: string, notes?: string) => {
    const newItem = await addItem({ ticker, companyName, notes })
    fetchQuotes([newItem.ticker]).catch(() => {
      // Best effort
    })
  }, [addItem, fetchQuotes])

  const handleRemove = useCallback(async (id: string) => {
    await removeItem(id)
  }, [removeItem])

  const handleEditNote = useCallback((item: WatchlistItem) => {
    setEditNoteItem(item)
  }, [])

  const handleSaveNote = useCallback(async (id: string, notes: string | null) => {
    await updateItem(id, { notes })
  }, [updateItem])

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-sv-text-secondary">
          <RefreshIcon spinning />
          <span className="text-sm">Loading watchlist...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-sv-text">Watchlist</h1>
          <p className="text-sm text-sv-text-muted mt-0.5">
            {items.length} ticker{items.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-sv-text-secondary hover:text-sv-text bg-sv-surface border border-sv-border rounded-md transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh quotes"
          >
            <RefreshIcon spinning={isRefreshing} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-sv-accent hover:bg-sv-accent/80 rounded-md transition-colors cursor-pointer"
          >
            <PlusIcon />
            Add Ticker
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-3 rounded-md bg-sv-negative/10 border border-sv-negative/20">
          <p className="text-sm text-sv-negative">{error}</p>
          <button
            onClick={clearError}
            className="text-sv-negative/60 hover:text-sv-negative transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-sv-text-muted">
          <EyeIcon />
          <h2 className="mt-4 text-lg font-medium text-sv-text-secondary">
            Your watchlist is empty
          </h2>
          <p className="mt-1 text-sm text-sv-text-muted text-center max-w-sm">
            Track tickers you're interested in without needing to hold a position.
            Add your first ticker to get started.
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="mt-6 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sv-accent hover:bg-sv-accent/80 rounded-md transition-colors cursor-pointer"
          >
            <PlusIcon />
            Add Your First Ticker
          </button>
        </div>
      ) : (
        <div className="bg-sv-surface rounded-lg border border-sv-border overflow-hidden">
          <WatchlistTable
            items={items}
            quotes={quotes}
            onRemove={handleRemove}
            onEditNote={handleEditNote}
          />
        </div>
      )}

      <AddToWatchlistModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAdd}
        existingTickers={existingTickers}
      />

      <EditNoteModal
        isOpen={editNoteItem !== null}
        item={editNoteItem}
        onClose={() => setEditNoteItem(null)}
        onSave={handleSaveNote}
      />
    </div>
  )
}
