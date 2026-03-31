import { useEffect, useState } from 'react'
import { formatPrice } from './formUtils'
import type { Transaction } from '../../types/index'

interface DeleteConfirmDialogProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly transaction: Transaction
  readonly onConfirm: () => void
}

function WarningIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className="text-sv-warning"
    >
      <path
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  transaction,
  onConfirm
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsDeleting(false)
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  async function handleDelete() {
    setIsDeleting(true)
    try {
      onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-sv-elevated rounded-lg w-full max-w-sm mx-4 shadow-xl border border-sv-border">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sv-warning/10">
              <WarningIcon />
            </div>
            <h2 className="text-lg font-semibold text-sv-text">Delete Transaction?</h2>
          </div>
          <p className="text-sm text-sv-text-secondary leading-relaxed">
            Are you sure you want to delete this{' '}
            <span className={transaction.type === 'BUY' ? 'text-sv-positive' : 'text-sv-negative'}>
              {transaction.type}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums text-sv-text">{transaction.shares}</span>{' '}
            shares of{' '}
            <span className="font-mono font-semibold text-sv-text">{transaction.ticker}</span>{' '}
            at{' '}
            <span className="font-mono tabular-nums text-sv-text">
              {formatPrice(transaction.price)}
            </span>
            ?
          </p>
        </div>

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
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-sv-negative hover:bg-sv-negative/80 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
