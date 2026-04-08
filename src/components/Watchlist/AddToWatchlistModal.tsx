import { useState, useEffect, useCallback } from 'react'
import { TickerSearch } from '../Forms/TickerSearch'
import { TEXTAREA_CLASS } from '../Forms/formUtils'
import type { SearchResult, Quote } from '../../types/index'

interface AddToWatchlistModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onAdd: (ticker: string, companyName: string, notes?: string) => Promise<void>
  readonly existingTickers: ReadonlyArray<string>
}

interface FormState {
  readonly ticker: string
  readonly companyName: string
  readonly notes: string
  readonly tickerValidated: boolean
  readonly currentPrice: number | null
  readonly dayChange: number | null
  readonly dayChangePercent: number | null
}

const INITIAL_FORM: FormState = {
  ticker: '',
  companyName: '',
  notes: '',
  tickerValidated: false,
  currentPrice: null,
  dayChange: null,
  dayChangePercent: null
}

export function AddToWatchlistModal({ isOpen, onClose, onAdd, existingTickers }: AddToWatchlistModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDuplicate = form.tickerValidated && existingTickers.includes(form.ticker)

  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM)
      setError(null)
      setIsSubmitting(false)
    }
  }, [isOpen])

  const fetchQuoteForTicker = useCallback(async (ticker: string) => {
    try {
      const quote: Quote = await window.electronAPI.getQuote(ticker)
      setForm((prev) => ({
        ...prev,
        currentPrice: quote.price,
        dayChange: quote.dayChange,
        dayChangePercent: quote.dayChangePercent,
        companyName: quote.companyName || prev.companyName
      }))
    } catch {
      // Quote fetch is best-effort for preview
    }
  }, [])

  function handleTickerChange(ticker: string) {
    setForm((prev) => ({
      ...prev,
      ticker,
      tickerValidated: false,
      companyName: '',
      currentPrice: null,
      dayChange: null,
      dayChangePercent: null
    }))
    setError(null)
  }

  function handleTickerSelect(result: SearchResult) {
    setForm((prev) => ({
      ...prev,
      ticker: result.ticker,
      companyName: result.name,
      tickerValidated: true
    }))
    setError(null)
    fetchQuoteForTicker(result.ticker)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.tickerValidated) {
      setError('Select a valid ticker from search results')
      return
    }

    if (isDuplicate) {
      setError(`${form.ticker} is already on your watchlist`)
      return
    }

    setIsSubmitting(true)
    try {
      await onAdd(form.ticker, form.companyName, form.notes || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to watchlist')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const changeColor = (form.dayChange ?? 0) >= 0 ? 'text-sv-positive' : 'text-sv-negative'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-sv-elevated rounded-lg w-full max-w-md mx-4 shadow-xl border border-sv-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sv-border">
          <h2 className="text-lg font-semibold text-sv-text">Add to Watchlist</h2>
          <button
            onClick={onClose}
            className="text-sv-text-muted hover:text-sv-text transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Ticker</label>
            <TickerSearch
              value={form.ticker}
              onChange={handleTickerChange}
              onSelect={handleTickerSelect}
            />
            {form.tickerValidated && !isDuplicate && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className="text-sv-text-secondary">{form.companyName}</span>
                {form.currentPrice !== null && (
                  <>
                    <span className="font-mono tabular-nums text-sv-text">
                      ${form.currentPrice.toFixed(2)}
                    </span>
                    {form.dayChange !== null && form.dayChangePercent !== null && (
                      <span className={`font-mono tabular-nums ${changeColor}`}>
                        {form.dayChange >= 0 ? '+' : ''}
                        {form.dayChange.toFixed(2)} ({form.dayChangePercent >= 0 ? '+' : ''}
                        {form.dayChangePercent.toFixed(2)}%)
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            {isDuplicate && (
              <p className="mt-1 text-xs text-sv-warning">
                {form.ticker} is already on your watchlist
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">
              Notes <span className="text-sv-text-muted">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              maxLength={1000}
              placeholder="Why are you watching this ticker?"
              className={TEXTAREA_CLASS}
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-md bg-sv-negative/10 border border-sv-negative/20">
              <p className="text-sm text-sv-negative">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sv-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-sv-text-secondary hover:text-sv-text bg-sv-surface border border-sv-border rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.tickerValidated || isDuplicate}
              className="px-4 py-2 text-sm font-medium text-white rounded-md bg-sv-accent hover:bg-sv-accent/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add to Watchlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
