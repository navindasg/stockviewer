import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { getMaxDateTimeLocal, toLocalDateTimeString, INPUT_CLASS, INPUT_CLASS_NO_MONO, TEXTAREA_CLASS } from './formUtils'
import type { Transaction, TransactionType, Quote } from '../../types/index'

interface EditTransactionModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly transaction: Transaction
}

interface FormState {
  readonly type: TransactionType
  readonly shares: string
  readonly price: string
  readonly date: string
  readonly fees: string
  readonly notes: string
  readonly companyName: string
  readonly currentPrice: number | null
}

interface FormErrors {
  readonly shares?: string
  readonly price?: string
  readonly date?: string
}

function createFormFromTransaction(tx: Transaction): FormState {
  return {
    type: tx.type,
    shares: String(tx.shares),
    price: String(tx.price),
    date: toLocalDateTimeString(new Date(tx.date)),
    fees: tx.fees > 0 ? String(tx.fees) : '',
    notes: tx.notes ?? '',
    companyName: '',
    currentPrice: null
  }
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}

  const shares = parseFloat(form.shares)
  if (!form.shares || isNaN(shares) || shares <= 0) {
    return { ...errors, shares: 'Shares must be greater than 0' }
  }

  const price = parseFloat(form.price)
  if (!form.price || isNaN(price) || price <= 0) {
    return { ...errors, price: 'Price must be greater than 0' }
  }

  if (!form.date) {
    return { ...errors, date: 'Date is required' }
  }

  const selectedDate = new Date(form.date)
  if (selectedDate > new Date()) {
    return { ...errors, date: 'Date cannot be in the future' }
  }

  return errors
}

export function EditTransactionModal({ isOpen, onClose, transaction }: EditTransactionModalProps) {
  const [form, setForm] = useState<FormState>(() => createFormFromTransaction(transaction))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const positions = useAppStore((state) => state.positions)
  const updateTransaction = useAppStore((state) => state.updateTransaction)

  const position = positions.find((p) => p.ticker === transaction.ticker)
  const availableShares = form.type === 'SELL' && position
    ? position.totalShares + (transaction.type === 'SELL' ? transaction.shares : 0)
    : 0

  const sellExceedsAvailable = form.type === 'SELL'
    && form.shares !== ''
    && parseFloat(form.shares) > availableShares

  const fetchQuote = useCallback(async () => {
    try {
      const quote: Quote = await window.electronAPI.getQuote(transaction.ticker)
      setForm((prev) => ({
        ...prev,
        companyName: quote.companyName,
        currentPrice: quote.price
      }))
    } catch {
      // Quote fetch is informational only, not critical
    }
  }, [transaction.ticker])

  useEffect(() => {
    if (isOpen) {
      setForm(createFormFromTransaction(transaction))
      setErrors({})
      setSubmitError(null)
      setIsSubmitting(false)
      fetchQuote()
    }
    // Only reset form when modal opens, not when transaction reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const { [key as keyof FormErrors]: _, ...rest } = prev as Record<string, string | undefined>
      return rest as FormErrors
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)

    const validationErrors = validateForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    if (sellExceedsAvailable) return

    setIsSubmitting(true)
    try {
      await updateTransaction(transaction.id, {
        type: form.type,
        shares: parseFloat(form.shares),
        price: parseFloat(form.price),
        date: new Date(form.date).toISOString(),
        fees: form.fees ? parseFloat(form.fees) : undefined,
        notes: form.notes || undefined
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update transaction')
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

  const isBuy = form.type === 'BUY'
  const submitDisabled = isSubmitting || sellExceedsAvailable

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-sv-elevated rounded-lg w-full max-w-md mx-4 shadow-xl border border-sv-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sv-border">
          <h2 className="text-lg font-semibold text-sv-text">Edit Transaction</h2>
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
            <input
              type="text"
              value={transaction.ticker}
              disabled
              className="w-full px-3 py-2 rounded-md font-mono text-sm bg-sv-surface border border-sv-border text-sv-text-muted cursor-not-allowed opacity-60"
            />
            {form.companyName && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-sv-text-secondary">{form.companyName}</span>
                {form.currentPrice !== null && (
                  <span className="text-sv-accent font-mono tabular-nums">
                    ${form.currentPrice.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Type</label>
            <div className="flex rounded-md overflow-hidden border border-sv-border">
              <button
                type="button"
                onClick={() => updateField('type', 'BUY')}
                className={`
                  flex-1 py-2 text-sm font-medium transition-colors cursor-pointer
                  ${isBuy
                    ? 'bg-sv-positive text-white'
                    : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
                  }
                `}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => updateField('type', 'SELL')}
                className={`
                  flex-1 py-2 text-sm font-medium transition-colors cursor-pointer
                  ${!isBuy
                    ? 'bg-sv-negative text-white'
                    : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
                  }
                `}
              >
                SELL
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Shares</label>
            <input
              type="number"
              value={form.shares}
              onChange={(e) => updateField('shares', e.target.value)}
              min="0.0001"
              step="any"
              placeholder="0"
              className={INPUT_CLASS}
            />
            {errors.shares && (
              <p className="mt-1 text-xs text-sv-negative">{errors.shares}</p>
            )}
            {form.type === 'SELL' && (
              <p className={`mt-1 text-xs ${sellExceedsAvailable ? 'text-sv-negative' : 'text-sv-text-muted'}`}>
                {availableShares.toFixed(4)} shares available
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Price per Share</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className={INPUT_CLASS}
            />
            {errors.price && (
              <p className="mt-1 text-xs text-sv-negative">{errors.price}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Date</label>
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              max={getMaxDateTimeLocal()}
              className={INPUT_CLASS_NO_MONO}
            />
            {errors.date && (
              <p className="mt-1 text-xs text-sv-negative">{errors.date}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">
              Fees <span className="text-sv-text-muted">(optional)</span>
            </label>
            <input
              type="number"
              value={form.fees}
              onChange={(e) => updateField('fees', e.target.value)}
              min="0"
              step="0.01"
              placeholder="0.00"
              className={INPUT_CLASS}
            />
          </div>

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
            type="submit"
            disabled={submitDisabled}
            onClick={handleSubmit}
            className={`
              px-4 py-2 text-sm font-medium text-white rounded-md transition-colors cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isBuy
                ? 'bg-sv-positive hover:bg-sv-positive/80'
                : 'bg-sv-negative hover:bg-sv-negative/80'
              }
            `}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
