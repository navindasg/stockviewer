import { useState, useEffect, useCallback } from 'react'
import { useDividendStore } from '../../stores/dividendStore'
import { useAppStore } from '../../stores/appStore'
import { TickerSearch } from '../Forms/TickerSearch'
import { INPUT_CLASS, INPUT_CLASS_NO_MONO, TEXTAREA_CLASS } from '../Forms/formUtils'
import type { DividendType, SearchResult, Quote } from '../../types/index'

interface AddDividendModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly prefillTicker?: string
}

interface FormState {
  readonly ticker: string
  readonly exDate: string
  readonly payDate: string
  readonly amountPerShare: string
  readonly sharesAtDate: string
  readonly type: DividendType
  readonly notes: string
  readonly companyName: string
  readonly tickerValidated: boolean
}

interface FormErrors {
  readonly ticker?: string
  readonly exDate?: string
  readonly payDate?: string
  readonly amountPerShare?: string
  readonly sharesAtDate?: string
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function createInitialState(prefillTicker?: string, prefillShares?: number): FormState {
  const today = getTodayString()
  return {
    ticker: prefillTicker ?? '',
    exDate: today,
    payDate: today,
    amountPerShare: '',
    sharesAtDate: prefillShares ? String(prefillShares) : '',
    type: 'CASH',
    notes: '',
    companyName: '',
    tickerValidated: !!prefillTicker
  }
}

function validateForm(form: FormState): FormErrors {
  const errors: Record<string, string> = {}

  if (!form.tickerValidated) {
    errors.ticker = 'Select a valid ticker from search results'
  }

  if (!form.exDate) {
    errors.exDate = 'Ex-date is required'
  } else if (new Date(form.exDate) > new Date()) {
    errors.exDate = 'Ex-date cannot be in the future'
  }

  if (!form.payDate) {
    errors.payDate = 'Pay date is required'
  }

  const amount = parseFloat(form.amountPerShare)
  if (!form.amountPerShare || isNaN(amount) || amount <= 0) {
    errors.amountPerShare = 'Amount per share must be greater than 0'
  }

  const shares = parseFloat(form.sharesAtDate)
  if (!form.sharesAtDate || isNaN(shares) || shares <= 0) {
    errors.sharesAtDate = 'Shares must be greater than 0'
  }

  return errors as FormErrors
}

export function AddDividendModal({ isOpen, onClose, prefillTicker }: AddDividendModalProps) {
  const positions = useAppStore((s) => s.positions)
  const addDividend = useDividendStore((s) => s.addDividend)
  const fetchPositions = useAppStore((s) => s.fetchPositions)

  const prefillPosition = prefillTicker
    ? positions.find((p) => p.ticker === prefillTicker)
    : undefined

  const [form, setForm] = useState<FormState>(() =>
    createInitialState(prefillTicker, prefillPosition?.totalShares)
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const pos = prefillTicker
        ? positions.find((p) => p.ticker === prefillTicker)
        : undefined
      setForm(createInitialState(prefillTicker, pos?.totalShares))
      setErrors({})
      setSubmitError(null)
      setIsSubmitting(false)
    }
  }, [isOpen, prefillTicker, positions])

  const fetchQuoteForTicker = useCallback(async (ticker: string) => {
    try {
      const quote: Quote = await window.electronAPI.getQuote(ticker)
      const pos = positions.find((p) => p.ticker === quote.ticker)
      setForm((prev) => ({
        ...prev,
        ticker: quote.ticker,
        companyName: quote.companyName,
        tickerValidated: true,
        sharesAtDate: pos ? String(pos.totalShares) : prev.sharesAtDate
      }))
    } catch {
      setForm((prev) => ({
        ...prev,
        tickerValidated: false,
        companyName: ''
      }))
    }
  }, [positions])

  useEffect(() => {
    if (isOpen && prefillTicker) {
      fetchQuoteForTicker(prefillTicker)
    }
  }, [isOpen, prefillTicker, fetchQuoteForTicker])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const { [key as keyof FormErrors]: _, ...rest } = prev as Record<string, string | undefined>
      return rest as FormErrors
    })
  }

  function handleTickerChange(ticker: string) {
    setForm((prev) => ({
      ...prev,
      ticker,
      tickerValidated: false,
      companyName: ''
    }))
  }

  function handleTickerSelect(result: SearchResult) {
    setForm((prev) => ({
      ...prev,
      ticker: result.ticker,
      companyName: result.name,
      tickerValidated: true
    }))
    fetchQuoteForTicker(result.ticker)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)

    const validationErrors = validateForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await addDividend({
        ticker: form.ticker,
        exDate: form.exDate,
        payDate: form.payDate,
        amountPerShare: parseFloat(form.amountPerShare),
        sharesAtDate: parseFloat(form.sharesAtDate),
        type: form.type,
        notes: form.notes || undefined
      })

      if (form.type === 'REINVESTED') {
        await fetchPositions()
      }

      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to add dividend')
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

  const totalAmount = form.amountPerShare && form.sharesAtDate
    ? (parseFloat(form.amountPerShare) * parseFloat(form.sharesAtDate))
    : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-sv-elevated rounded-lg w-full max-w-md mx-4 shadow-xl border border-sv-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sv-border">
          <h2 className="text-lg font-semibold text-sv-text">Record Dividend</h2>
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

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Ticker</label>
            {prefillTicker ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sv-surface border border-sv-border">
                <span className="text-sm font-semibold text-sv-text">{form.ticker}</span>
                <span className="text-xs text-sv-text-muted">{form.companyName}</span>
              </div>
            ) : (
              <TickerSearch
                value={form.ticker}
                onChange={handleTickerChange}
                onSelect={handleTickerSelect}
              />
            )}
            {errors.ticker && (
              <p className="mt-1 text-xs text-sv-negative">{errors.ticker}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Type</label>
            <div className="flex rounded-md overflow-hidden border border-sv-border">
              <button
                type="button"
                onClick={() => updateField('type', 'CASH')}
                className={`
                  flex-1 py-2 text-sm font-medium transition-colors cursor-pointer
                  ${form.type === 'CASH'
                    ? 'bg-sv-accent text-white'
                    : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
                  }
                `}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => updateField('type', 'REINVESTED')}
                className={`
                  flex-1 py-2 text-sm font-medium transition-colors cursor-pointer
                  ${form.type === 'REINVESTED'
                    ? 'bg-sv-positive text-white'
                    : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
                  }
                `}
              >
                Reinvested (DRIP)
              </button>
            </div>
            {form.type === 'REINVESTED' && (
              <p className="mt-1 text-xs text-sv-text-muted">
                A BUY transaction will be auto-generated for the reinvested amount.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-sv-text-secondary mb-1">Ex-Date</label>
              <input
                type="date"
                value={form.exDate}
                onChange={(e) => updateField('exDate', e.target.value)}
                className={INPUT_CLASS_NO_MONO}
              />
              {errors.exDate && (
                <p className="mt-1 text-xs text-sv-negative">{errors.exDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-sv-text-secondary mb-1">Pay Date</label>
              <input
                type="date"
                value={form.payDate}
                onChange={(e) => updateField('payDate', e.target.value)}
                className={INPUT_CLASS_NO_MONO}
              />
              {errors.payDate && (
                <p className="mt-1 text-xs text-sv-negative">{errors.payDate}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-sv-text-secondary mb-1">Amount Per Share</label>
              <input
                type="number"
                value={form.amountPerShare}
                onChange={(e) => updateField('amountPerShare', e.target.value)}
                min="0.0001"
                step="any"
                placeholder="0.0000"
                className={INPUT_CLASS}
              />
              {errors.amountPerShare && (
                <p className="mt-1 text-xs text-sv-negative">{errors.amountPerShare}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-sv-text-secondary mb-1">Shares Held</label>
              <input
                type="number"
                value={form.sharesAtDate}
                onChange={(e) => updateField('sharesAtDate', e.target.value)}
                min="0.0001"
                step="any"
                placeholder="0"
                className={INPUT_CLASS}
              />
              {errors.sharesAtDate && (
                <p className="mt-1 text-xs text-sv-negative">{errors.sharesAtDate}</p>
              )}
            </div>
          </div>

          {totalAmount > 0 && (
            <div className="px-3 py-2 rounded-md bg-sv-surface border border-sv-border">
              <div className="flex justify-between items-center">
                <span className="text-xs text-sv-text-muted">Total Dividend</span>
                <span className="text-sm font-mono tabular-nums font-semibold text-sv-positive">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">
              Notes <span className="text-sv-text-muted">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className={TEXTAREA_CLASS}
            />
          </div>

          {submitError && (
            <div className="px-3 py-2 rounded-md bg-sv-negative/10 border border-sv-negative/20">
              <p className="text-sm text-sv-negative">{submitError}</p>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-sv-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-sv-text-secondary hover:text-sv-text bg-sv-surface border border-sv-border rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors cursor-pointer bg-sv-positive hover:bg-sv-positive/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Record Dividend'}
          </button>
        </div>
      </div>
    </div>
  )
}
