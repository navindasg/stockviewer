import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useFilters } from '../../hooks/useFilters'
import { EditTransactionModal } from '../Forms/EditTransactionModal'
import { DeleteConfirmDialog } from '../Forms/DeleteConfirmDialog'
import { formatCurrency, formatDate, formatShares } from '../../utils/formatters'
import type { Transaction, TransactionType } from '../../types/index'
import {
  filterTransactions,
  sortTransactions,
  getUniqueTickers,
  type SortColumn,
  type SortDirection
} from './transactionUtils'

interface SortIndicatorProps {
  readonly column: SortColumn
  readonly activeColumn: SortColumn
  readonly direction: SortDirection
}

function SortIndicator({ column, activeColumn, direction }: SortIndicatorProps) {
  if (column !== activeColumn) {
    return <span className="text-sv-text-muted ml-1 opacity-0 group-hover:opacity-50">▲</span>
  }
  return (
    <span className="text-sv-accent ml-1">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  )
}

interface TypeFilterProps {
  readonly value: TransactionType | 'ALL'
  readonly onChange: (value: TransactionType | 'ALL') => void
}

function TypeFilterButtons({ value, onChange }: TypeFilterProps) {
  const options: ReadonlyArray<{ readonly label: string; readonly val: TransactionType | 'ALL' }> = [
    { label: 'All', val: 'ALL' },
    { label: 'BUY', val: 'BUY' },
    { label: 'SELL', val: 'SELL' }
  ]

  return (
    <div className="flex rounded-lg overflow-hidden border border-sv-border">
      {options.map((opt) => (
        <button
          key={opt.val}
          type="button"
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.val
              ? 'bg-sv-accent text-white'
              : 'bg-sv-surface text-sv-text-secondary hover:bg-sv-elevated'
          }`}
          onClick={() => onChange(opt.val)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-sv-text-muted text-sm">No transactions found</p>
    </div>
  )
}

const COLUMN_HEADERS: ReadonlyArray<{ readonly key: SortColumn; readonly label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'type', label: 'Type' },
  { key: 'shares', label: 'Shares' },
  { key: 'price', label: 'Price/Share' },
  { key: 'total', label: 'Total' },
  { key: 'fees', label: 'Fees' }
]

export function TransactionsView() {
  const { filters } = useFilters()
  const setSelectedTicker = useAppStore((s) => s.setSelectedTicker)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)

  const [transactions, setTransactions] = useState<ReadonlyArray<Transaction>>([])
  const [sortColumn, setSortColumn] = useState<SortColumn>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [tickerFilter, setTickerFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null)

  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId)

  const loadTransactions = useCallback(async () => {
    try {
      const data = await window.electronAPI.getTransactions(
        activePortfolioId !== null ? { portfolioId: activePortfolioId } : undefined
      )
      setTransactions(data)
    } catch (error) {
      throw new Error(
        `Failed to load transactions: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }, [activePortfolioId])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const uniqueTickers = useMemo(() => getUniqueTickers(transactions), [transactions])

  const filteredAndSorted = useMemo(() => {
    const filtered = filterTransactions(transactions, {
      searchText: filters.searchText,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      tickerFilter,
      typeFilter
    })
    return sortTransactions(filtered, sortColumn, sortDirection)
  }, [transactions, filters.searchText, filters.dateFrom, filters.dateTo, tickerFilter, typeFilter, sortColumn, sortDirection])

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDirection('desc')
      return column
    })
  }, [])

  const handleTickerClick = useCallback((ticker: string) => {
    setSelectedTicker(ticker)
    setActiveView('position-detail')
  }, [setSelectedTicker, setActiveView])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTx) return
    try {
      await deleteTransaction(deletingTx.id)
      setDeletingTx(null)
      await loadTransactions()
    } catch (error) {
      throw new Error(
        `Failed to delete transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }, [deletingTx, deleteTransaction, loadTransactions])

  const handleEditClose = useCallback(() => {
    setEditingTx(null)
    loadTransactions()
  }, [loadTransactions])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sv-text">Transactions</h1>
        <span className="text-xs text-sv-text-muted font-mono tabular-nums">
          {filteredAndSorted.length} transaction{filteredAndSorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
          className="bg-sv-surface border border-sv-border rounded-lg px-3 py-1.5 text-xs text-sv-text focus:outline-none focus:ring-1 focus:ring-sv-accent"
        >
          <option value="">All Tickers</option>
          {uniqueTickers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <TypeFilterButtons value={typeFilter} onChange={setTypeFilter} />
      </div>

      {filteredAndSorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sv-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sv-elevated text-sv-text-secondary text-xs">
                {COLUMN_HEADERS.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none group hover:text-sv-text transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIndicator column={col.key} activeColumn={sortColumn} direction={sortDirection} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium">Notes</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sv-border">
              {filteredAndSorted.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onTickerClick={handleTickerClick}
                  onEdit={setEditingTx}
                  onDelete={setDeletingTx}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingTx && (
        <EditTransactionModal
          isOpen={true}
          onClose={handleEditClose}
          transaction={editingTx}
        />
      )}

      {deletingTx && (
        <DeleteConfirmDialog
          isOpen={true}
          onClose={() => setDeletingTx(null)}
          transaction={deletingTx}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}

interface TransactionRowProps {
  readonly transaction: Transaction
  readonly onTickerClick: (ticker: string) => void
  readonly onEdit: (tx: Transaction) => void
  readonly onDelete: (tx: Transaction) => void
}

function TransactionRow({ transaction, onTickerClick, onEdit, onDelete }: TransactionRowProps) {
  const isBuy = transaction.type === 'BUY'
  const rowBg = isBuy ? 'bg-sv-positive/5' : 'bg-sv-negative/5'
  const typeColor = isBuy ? 'text-sv-positive' : 'text-sv-negative'
  const total = transaction.shares * transaction.price

  return (
    <tr className={`${rowBg} hover:bg-sv-elevated/50 transition-colors`}>
      <td className="px-4 py-3 text-sv-text font-mono tabular-nums whitespace-nowrap">
        {formatDate(transaction.date)}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          className="text-sv-accent font-semibold hover:underline"
          onClick={() => onTickerClick(transaction.ticker)}
        >
          {transaction.ticker}
        </button>
      </td>
      <td className={`px-4 py-3 font-bold ${typeColor}`}>
        {transaction.type}
      </td>
      <td className="px-4 py-3 text-sv-text font-mono tabular-nums">
        {formatShares(transaction.shares)}
      </td>
      <td className="px-4 py-3 text-sv-text font-mono tabular-nums">
        {formatCurrency(transaction.price)}
      </td>
      <td className="px-4 py-3 text-sv-text font-mono tabular-nums">
        {formatCurrency(total)}
      </td>
      <td className="px-4 py-3 text-sv-text-secondary font-mono tabular-nums">
        {formatCurrency(transaction.fees)}
      </td>
      <td className="px-4 py-3 text-sv-text-muted text-xs max-w-[200px] truncate">
        {transaction.notes ?? '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="p-1.5 rounded text-sv-text-muted hover:text-sv-accent hover:bg-sv-elevated transition-colors"
            onClick={() => onEdit(transaction)}
            aria-label="Edit transaction"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="p-1.5 rounded text-sv-text-muted hover:text-sv-negative hover:bg-sv-elevated transition-colors"
            onClick={() => onDelete(transaction)}
            aria-label="Delete transaction"
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}
