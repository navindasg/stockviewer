import { useState, useEffect, useCallback } from 'react'
import { useOptionsStore } from '../../stores/optionsStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { TickerSearch } from './TickerSearch'
import { PortfolioSelect } from '../Portfolios/PortfolioSelect'
import { getMaxDateTimeLocal, getNowLocalDateTimeString, INPUT_CLASS, INPUT_CLASS_NO_MONO, TEXTAREA_CLASS } from './formUtils'
import { buildOccSymbol } from '../../utils/occSymbol'
import type { OptionAction, OptionType, SearchResult, Quote } from '../../types/index'

interface AddOptionTransactionModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly prefillTicker?: string
  readonly prefillOptionType?: OptionType
  readonly prefillStrike?: number
  readonly prefillExpiration?: string
  readonly prefillAction?: OptionAction
}

interface FormState {
  readonly ticker: string
  readonly optionAction: OptionAction
  readonly optionType: OptionType
  readonly strikePrice: string
  readonly expirationDate: string
  readonly contracts: string
  readonly price: string
  readonly date: string
  readonly fees: string
  readonly notes: string
  readonly companyName: string
  readonly currentPrice: number | null
  readonly tickerValidated: boolean
  readonly portfolioId: number | undefined
}

interface FormErrors {
  readonly ticker?: string
  readonly strikePrice?: string
  readonly expirationDate?: string
  readonly contracts?: string
  readonly price?: string
  readonly date?: string
}

const OPTION_ACTIONS: ReadonlyArray<{ readonly value: OptionAction; readonly label: string; readonly color: string }> = [
  { value: 'BUY_TO_OPEN', label: 'Buy to Open', color: 'bg-sv-positive' },
  { value: 'SELL_TO_CLOSE', label: 'Sell to Close', color: 'bg-sv-negative' },
  { value: 'SELL_TO_OPEN', label: 'Sell to Open', color: 'bg-sv-negative' },
  { value: 'BUY_TO_CLOSE', label: 'Buy to Close', color: 'bg-sv-positive' },
  { value: 'EXERCISE', label: 'Exercise', color: 'bg-sv-accent' },
  { value: 'ASSIGNMENT', label: 'Assignment', color: 'bg-amber-600' },
  { value: 'EXPIRE', label: 'Expire Worthless', color: 'bg-sv-text-muted' }
]

function createInitialState(props: AddOptionTransactionModalProps): FormState {
  const activePortfolioId = usePortfolioStore.getState().activePortfolioId
  return {
    ticker: props.prefillTicker ?? '',
    optionAction: props.prefillAction ?? 'BUY_TO_OPEN',
    optionType: props.prefillOptionType ?? 'CALL',
    strikePrice: props.prefillStrike?.toString() ?? '',
    expirationDate: props.prefillExpiration ?? '',
    contracts: '',
    price: '',
    date: getNowLocalDateTimeString(),
    fees: '',
    notes: '',
    companyName: '',
    currentPrice: null,
    tickerValidated: !!props.prefillTicker,
    portfolioId: activePortfolioId ?? undefined
  }
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!form.tickerValidated) {
    return { ticker: 'Select a valid ticker from search results' }
  }

  const strike = parseFloat(form.strikePrice)
  if (!form.strikePrice || isNaN(strike) || strike <= 0) {
    return { ...errors, strikePrice: 'Strike price must be greater than 0' }
  }

  if (!form.expirationDate) {
    return { ...errors, expirationDate: 'Expiration date is required' }
  }

  const contracts = parseInt(form.contracts, 10)
  if (!form.contracts || isNaN(contracts) || contracts <= 0 || !Number.isInteger(contracts)) {
    return { ...errors, contracts: 'Contracts must be a positive whole number' }
  }

  const price = parseFloat(form.price)
  if (!form.price || isNaN(price) || price < 0) {
    return { ...errors, price: 'Premium must be 0 or greater' }
  }

  if (!form.date) {
    return { ...errors, date: 'Date is required' }
  }
  if (new Date(form.date) > new Date()) {
    return { ...errors, date: 'Date cannot be in the future' }
  }

  return errors
}

export function AddOptionTransactionModal({
  isOpen,
  onClose,
  prefillTicker,
  prefillOptionType,
  prefillStrike,
  prefillExpiration,
  prefillAction
}: AddOptionTransactionModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    createInitialState({ isOpen, onClose, prefillTicker, prefillOptionType, prefillStrike, prefillExpiration, prefillAction })
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addOptionTransaction = useOptionsStore((state) => state.addOptionTransaction)

  const fetchQuoteForTicker = useCallback(async (ticker: string) => {
    try {
      const quote: Quote = await window.electronAPI.getQuote(ticker)
      setForm((prev) => ({
        ...prev,
        ticker: quote.ticker,
        companyName: quote.companyName,
        currentPrice: quote.price,
        tickerValidated: true
      }))
    } catch {
      setForm((prev) => ({
        ...prev,
        tickerValidated: false,
        companyName: '',
        currentPrice: null
      }))
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setForm(createInitialState({ isOpen, onClose, prefillTicker, prefillOptionType, prefillStrike, prefillExpiration, prefillAction }))
      setErrors({})
      setSubmitError(null)
      setIsSubmitting(false)
    }
  }, [isOpen, prefillTicker, prefillOptionType, prefillStrike, prefillExpiration, prefillAction, onClose])

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
      companyName: '',
      currentPrice: null
    }))
    setErrors((prev) => {
      const { ticker: _, ...rest } = prev
      return rest
    })
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
      await addOptionTransaction({
        ticker: form.ticker,
        optionAction: form.optionAction,
        optionType: form.optionType,
        strikePrice: parseFloat(form.strikePrice),
        expirationDate: form.expirationDate,
        contracts: parseInt(form.contracts, 10),
        price: parseFloat(form.price),
        date: new Date(form.date).toISOString(),
        fees: form.fees ? parseFloat(form.fees) : undefined,
        notes: form.notes || undefined,
        portfolioId: form.portfolioId
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to add option transaction')
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

  const occPreview = form.tickerValidated && form.strikePrice && form.expirationDate
    ? buildOccSymbol(form.ticker, form.expirationDate, form.optionType, parseFloat(form.strikePrice))
    : null

  const activeAction = OPTION_ACTIONS.find((a) => a.value === form.optionAction)
  const isBuyAction = form.optionAction === 'BUY_TO_OPEN' || form.optionAction === 'BUY_TO_CLOSE'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-sv-elevated rounded-lg w-full max-w-lg mx-4 shadow-xl border border-sv-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sv-border">
          <h2 className="text-lg font-semibold text-sv-text">Add Option Trade</h2>
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
          {/* Underlying Ticker */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Underlying Ticker</label>
            <TickerSearch
              value={form.ticker}
              onChange={handleTickerChange}
              onSelect={handleTickerSelect}
            />
            {errors.ticker && <p className="mt-1 text-xs text-sv-negative">{errors.ticker}</p>}
            {form.tickerValidated && (
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

          <PortfolioSelect
            value={form.portfolioId}
            onChange={(id) => updateField('portfolioId', id)}
          />

          {/* Option Type (Call/Put) */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Option Type</label>
            <div className="flex rounded-md overflow-hidden border border-sv-border">
              <button
                type="button"
                onClick={() => updateField('optionType', 'CALL')}
                className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  form.optionType === 'CALL'
                    ? 'bg-sv-positive text-white'
                    : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
                }`}
              >
                CALL
              </button>
              <button
                type="button"
                onClick={() => updateField('optionType', 'PUT')}
                className={`flex-1 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  form.optionType === 'PUT'
                    ? 'bg-sv-negative text-white'
                    : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
                }`}
              >
                PUT
              </button>
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Action</label>
            <div className="grid grid-cols-2 gap-1.5">
              {OPTION_ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => updateField('optionAction', action.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer border ${
                    form.optionAction === action.value
                      ? `${action.color} text-white border-transparent`
                      : 'bg-sv-surface text-sv-text-secondary border-sv-border hover:text-sv-text hover:border-sv-text-muted'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strike Price */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Strike Price</label>
            <input
              type="number"
              value={form.strikePrice}
              onChange={(e) => updateField('strikePrice', e.target.value)}
              min="0.01"
              step="0.50"
              placeholder="0.00"
              className={INPUT_CLASS}
            />
            {errors.strikePrice && <p className="mt-1 text-xs text-sv-negative">{errors.strikePrice}</p>}
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Expiration Date</label>
            <input
              type="date"
              value={form.expirationDate}
              onChange={(e) => updateField('expirationDate', e.target.value)}
              className={INPUT_CLASS_NO_MONO}
            />
            {errors.expirationDate && <p className="mt-1 text-xs text-sv-negative">{errors.expirationDate}</p>}
          </div>

          {/* OCC Symbol Preview */}
          {occPreview && (
            <div className="px-3 py-2 rounded-md bg-sv-surface border border-sv-border">
              <p className="text-xs text-sv-text-muted">
                OCC Symbol: <span className="text-sv-text font-mono tabular-nums">{occPreview}</span>
              </p>
            </div>
          )}

          {/* Number of Contracts */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Contracts</label>
            <input
              type="number"
              value={form.contracts}
              onChange={(e) => updateField('contracts', e.target.value)}
              min="1"
              step="1"
              placeholder="0"
              className={INPUT_CLASS}
            />
            {errors.contracts && <p className="mt-1 text-xs text-sv-negative">{errors.contracts}</p>}
            {form.contracts && parseInt(form.contracts, 10) > 0 && (
              <p className="mt-1 text-xs text-sv-text-muted">
                = {parseInt(form.contracts, 10) * 100} shares equivalent
              </p>
            )}
          </div>

          {/* Premium per Share */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">
              Premium per Share
            </label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              min="0"
              step="0.01"
              placeholder="0.00"
              className={INPUT_CLASS}
            />
            {errors.price && <p className="mt-1 text-xs text-sv-negative">{errors.price}</p>}
            {form.price && form.contracts && parseFloat(form.price) > 0 && parseInt(form.contracts, 10) > 0 && (
              <p className="mt-1 text-xs text-sv-text-muted">
                Total: ${(parseFloat(form.price) * parseInt(form.contracts, 10) * 100).toFixed(2)}
              </p>
            )}
          </div>

          {/* Trade Date */}
          <div>
            <label className="block text-sm font-medium text-sv-text-secondary mb-1">Trade Date</label>
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              max={getMaxDateTimeLocal()}
              className={INPUT_CLASS_NO_MONO}
            />
            {errors.date && <p className="mt-1 text-xs text-sv-negative">{errors.date}</p>}
          </div>

          {/* Fees */}
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

          {/* Notes */}
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
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isBuyAction
                  ? 'bg-sv-positive hover:bg-sv-positive/80'
                  : 'bg-sv-negative hover:bg-sv-negative/80'
              }`}
            >
              {isSubmitting ? 'Submitting...' : activeAction?.label ?? 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
