import { useState, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { EditTransactionModal } from '../Forms/EditTransactionModal'
import { DeleteConfirmDialog } from '../Forms/DeleteConfirmDialog'
import { formatCurrency, formatDate, formatShares } from '../../utils/formatters'
import type { Transaction } from '../../types/index'

interface TransactionHistoryProps {
  readonly transactions: ReadonlyArray<Transaction>
  readonly ticker: string
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function TransactionHistory({ transactions, ticker }: TransactionHistoryProps) {
  const deleteTransaction = useAppStore((state) => state.deleteTransaction)
  const fetchPositions = useAppStore((state) => state.fetchPositions)

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)

  const handleCloseEdit = useCallback(() => {
    setEditingTransaction(null)
  }, [])

  const handleCloseDelete = useCallback(() => {
    setDeletingTransaction(null)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (deletingTransaction === null) return
    try {
      await deleteTransaction(deletingTransaction.id)
      await fetchPositions()
    } catch (error) {
      throw new Error(
        `Failed to delete transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setDeletingTransaction(null)
    }
  }, [deletingTransaction, deleteTransaction, fetchPositions])

  if (transactions.length === 0) {
    return (
      <div className="text-sv-text-muted text-sm text-center py-6">
        No transactions for {ticker}
      </div>
    )
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return (
    <div className="flex flex-col">
      <h3 className="text-sv-text text-sm font-semibold mb-2">Transaction History</h3>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-sv-text-muted border-b border-sv-border">
              <th className="text-left py-1.5 px-1 font-medium">Date</th>
              <th className="text-left py-1.5 px-1 font-medium">Type</th>
              <th className="text-right py-1.5 px-1 font-medium">Shares</th>
              <th className="text-right py-1.5 px-1 font-medium">Price</th>
              <th className="text-right py-1.5 px-1 font-medium">Total</th>
              <th className="text-right py-1.5 px-1 font-medium">Fees</th>
              <th className="text-left py-1.5 px-1 font-medium">Notes</th>
              <th className="py-1.5 px-1" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onEdit={setEditingTransaction}
                onDelete={setDeletingTransaction}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editingTransaction !== null && (
        <EditTransactionModal
          isOpen={true}
          onClose={handleCloseEdit}
          transaction={editingTransaction}
        />
      )}

      {deletingTransaction !== null && (
        <DeleteConfirmDialog
          isOpen={true}
          onClose={handleCloseDelete}
          transaction={deletingTransaction}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

interface TransactionRowProps {
  readonly transaction: Transaction
  readonly onEdit: (tx: Transaction) => void
  readonly onDelete: (tx: Transaction) => void
}

function TransactionRow({ transaction, onEdit, onDelete }: TransactionRowProps) {
  const isBuy = transaction.type === 'BUY'
  const rowBg = isBuy ? 'bg-sv-positive/5' : 'bg-sv-negative/5'
  const typeColor = isBuy ? 'text-sv-positive' : 'text-sv-negative'
  const total = transaction.shares * transaction.price

  return (
    <tr className={`${rowBg} border-b border-sv-border/50 hover:bg-sv-elevated/50`}>
      <td className="py-1.5 px-1 text-sv-text-secondary">{formatDate(transaction.date)}</td>
      <td className={`py-1.5 px-1 font-semibold ${typeColor}`}>{transaction.type}</td>
      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-sv-text">
        {formatShares(transaction.shares)}
      </td>
      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-sv-text">
        {formatCurrency(transaction.price)}
      </td>
      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-sv-text">
        {formatCurrency(total)}
      </td>
      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-sv-text-muted">
        {formatCurrency(transaction.fees)}
      </td>
      <td className="py-1.5 px-1 text-sv-text-muted truncate max-w-[80px]" title={transaction.notes ?? ''}>
        {transaction.notes ?? '—'}
      </td>
      <td className="py-1.5 px-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(transaction)}
            className="text-sv-text-muted hover:text-sv-accent transition-colors p-0.5"
            title="Edit transaction"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => onDelete(transaction)}
            className="text-sv-text-muted hover:text-sv-negative transition-colors p-0.5"
            title="Delete transaction"
          >
            <DeleteIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}
