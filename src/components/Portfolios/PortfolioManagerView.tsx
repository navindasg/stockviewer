import { useState, useEffect, useCallback } from 'react'
import { usePortfolioStore } from '../../stores/portfolioStore'
import type { Portfolio, CostBasisMethod } from '../../types/index'

const COST_BASIS_OPTIONS: ReadonlyArray<{ value: CostBasisMethod; label: string }> = [
  { value: 'AVGCOST', label: 'Average Cost' },
  { value: 'FIFO', label: 'FIFO' },
  { value: 'LIFO', label: 'LIFO' },
  { value: 'SPECIFIC', label: 'Specific ID' }
]

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 2.5L11.5 4.5M2 12L2.5 9.5L10 2L12 4L3.5 12.5L2 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 4H11.5M5 4V2.5H9V4M5.5 6V10.5M8.5 6V10.5M3.5 4L4 11.5H10L10.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface FormState {
  readonly name: string
  readonly description: string
  readonly defaultCostBasisMethod: CostBasisMethod
}

const INITIAL_FORM: FormState = {
  name: '',
  description: '',
  defaultCostBasisMethod: 'AVGCOST'
}

function CreatePortfolioForm({ onClose }: { readonly onClose: () => void }) {
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.name.trim().length === 0) {
      setError('Portfolio name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await createPortfolio({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        defaultCostBasisMethod: form.defaultCostBasisMethod
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create portfolio')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, createPortfolio, onClose])

  return (
    <div className="bg-sv-elevated border border-sv-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-sv-text mb-4">New Portfolio</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-sv-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            maxLength={100}
            placeholder="e.g. Roth IRA"
            className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sv-text-secondary mb-1">
            Description <span className="text-sv-text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            maxLength={200}
            placeholder="Optional description"
            className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sv-text-secondary mb-1">Default Cost Basis Method</label>
          <select
            value={form.defaultCostBasisMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, defaultCostBasisMethod: e.target.value as CostBasisMethod }))}
            className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent"
          >
            {COST_BASIS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-md bg-sv-negative/10 border border-sv-negative/20">
            <p className="text-xs text-sv-negative">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-sv-accent rounded-md hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-sv-text-secondary bg-sv-surface border border-sv-border rounded-md hover:text-sv-text transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function EditPortfolioForm({
  portfolio,
  onClose
}: {
  readonly portfolio: Portfolio
  readonly onClose: () => void
}) {
  const [form, setForm] = useState<FormState>({
    name: portfolio.name,
    description: portfolio.description ?? '',
    defaultCostBasisMethod: portfolio.defaultCostBasisMethod
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const updatePortfolio = usePortfolioStore((s) => s.updatePortfolio)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.name.trim().length === 0) {
      setError('Portfolio name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await updatePortfolio(portfolio.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        defaultCostBasisMethod: form.defaultCostBasisMethod
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update portfolio')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, portfolio.id, updatePortfolio, onClose])

  return (
    <div className="bg-sv-elevated border border-sv-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-sv-text mb-4">Edit Portfolio</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-sv-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            maxLength={100}
            className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sv-text-secondary mb-1">
            Description <span className="text-sv-text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            maxLength={200}
            className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sv-text-secondary mb-1">Default Cost Basis Method</label>
          <select
            value={form.defaultCostBasisMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, defaultCostBasisMethod: e.target.value as CostBasisMethod }))}
            className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent"
          >
            {COST_BASIS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-md bg-sv-negative/10 border border-sv-negative/20">
            <p className="text-xs text-sv-negative">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-sv-accent rounded-md hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-sv-text-secondary bg-sv-surface border border-sv-border rounded-md hover:text-sv-text transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function DeleteConfirmation({
  portfolio,
  onClose
}: {
  readonly portfolio: Portfolio
  readonly onClose: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deletePortfolio = usePortfolioStore((s) => s.deletePortfolio)

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await deletePortfolio(portfolio.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete portfolio')
    } finally {
      setIsDeleting(false)
    }
  }, [portfolio.id, deletePortfolio, onClose])

  return (
    <div className="bg-sv-elevated border border-sv-negative/30 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-sv-negative mb-2">Delete Portfolio</h3>
      <p className="text-sm text-sv-text-secondary mb-1">
        Are you sure you want to delete <span className="font-semibold text-sv-text">{portfolio.name}</span>?
      </p>
      <p className="text-xs text-sv-text-muted mb-4">
        This will permanently delete all transactions, tax lots, and dividends in this portfolio.
        This action cannot be undone.
      </p>

      {error && (
        <div className="px-3 py-2 rounded-md bg-sv-negative/10 border border-sv-negative/20 mb-3">
          <p className="text-xs text-sv-negative">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-4 py-2 text-sm font-medium text-white bg-sv-negative rounded-md hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete Portfolio'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-sv-text-secondary bg-sv-surface border border-sv-border rounded-md hover:text-sv-text transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PortfolioCard({
  portfolio,
  onEdit,
  onDelete
}: {
  readonly portfolio: Portfolio
  readonly onEdit: () => void
  readonly onDelete: () => void
}) {
  const costBasisLabel = COST_BASIS_OPTIONS.find((o) => o.value === portfolio.defaultCostBasisMethod)?.label ?? portfolio.defaultCostBasisMethod

  return (
    <div className="bg-sv-surface border border-sv-border rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-sv-text truncate">{portfolio.name}</h3>
          {portfolio.isDefault && (
            <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-sv-accent bg-sv-accent/10 rounded">
              DEFAULT
            </span>
          )}
        </div>
        {portfolio.description && (
          <p className="text-xs text-sv-text-muted mb-2 truncate">{portfolio.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-sv-text-muted">
          <span>Cost Basis: <span className="text-sv-text-secondary">{costBasisLabel}</span></span>
          <span>Created: <span className="text-sv-text-secondary">{new Date(portfolio.createdAt).toLocaleDateString()}</span></span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded text-sv-text-muted hover:text-sv-accent hover:bg-sv-elevated transition-colors cursor-pointer"
          title="Edit portfolio"
        >
          <EditIcon />
        </button>
        {!portfolio.isDefault && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded text-sv-text-muted hover:text-sv-negative hover:bg-sv-negative/10 transition-colors cursor-pointer"
            title="Delete portfolio"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  )
}

export function PortfolioManagerView() {
  const portfolios = usePortfolioStore((s) => s.portfolios)
  const portfoliosLoading = usePortfolioStore((s) => s.portfoliosLoading)
  const fetchPortfolios = usePortfolioStore((s) => s.fetchPortfolios)

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    fetchPortfolios().catch(() => {})
  }, [fetchPortfolios])

  const editingPortfolio = editingId !== null ? portfolios.find((p) => p.id === editingId) ?? null : null
  const deletingPortfolio = deletingId !== null ? portfolios.find((p) => p.id === deletingId) ?? null : null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-sv-text">Portfolios</h1>
          <p className="text-sm text-sv-text-muted mt-0.5">
            Manage your investment portfolios
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true)
            setEditingId(null)
            setDeletingId(null)
          }}
          className="
            flex items-center gap-1.5 px-3 py-2 rounded-md
            bg-sv-accent text-white text-sm font-medium
            hover:brightness-110 transition-all cursor-pointer
          "
        >
          <PlusIcon />
          <span>New Portfolio</span>
        </button>
      </div>

      {showCreate && (
        <div className="mb-4">
          <CreatePortfolioForm onClose={() => setShowCreate(false)} />
        </div>
      )}

      {editingPortfolio && (
        <div className="mb-4">
          <EditPortfolioForm
            portfolio={editingPortfolio}
            onClose={() => setEditingId(null)}
          />
        </div>
      )}

      {deletingPortfolio && (
        <div className="mb-4">
          <DeleteConfirmation
            portfolio={deletingPortfolio}
            onClose={() => setDeletingId(null)}
          />
        </div>
      )}

      {portfoliosLoading && portfolios.length === 0 ? (
        <div className="text-center py-12 text-sv-text-muted text-sm">
          Loading portfolios...
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center py-12 text-sv-text-muted text-sm">
          No portfolios found. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              onEdit={() => {
                setEditingId(portfolio.id)
                setShowCreate(false)
                setDeletingId(null)
              }}
              onDelete={() => {
                setDeletingId(portfolio.id)
                setShowCreate(false)
                setEditingId(null)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
