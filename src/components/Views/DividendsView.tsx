import { useState, useCallback, useRef, useEffect } from 'react'
import { useDividends, useDividendSummary } from '../../hooks/useDividends'
import { useDividendStore } from '../../stores/dividendStore'
import { DividendSummaryCards } from '../Dividends/DividendSummaryCards'
import { DividendHistoryTable } from '../Dividends/DividendHistoryTable'
import { DividendIncomeChart } from '../Dividends/DividendIncomeChart'
import { UpcomingDividends } from '../Dividends/UpcomingDividends'
import { AddDividendModal } from '../Dividends/AddDividendModal'

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EmptyState({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-sv-positive/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-sv-text mb-2">
          No dividends recorded yet
        </h2>
        <p className="text-sm text-sv-text-muted max-w-sm">
          Record your first dividend payment to start tracking income, yields, and reinvestments across your portfolio.
        </p>
      </div>
      <button
        type="button"
        className="px-6 py-3 rounded-lg bg-sv-positive text-white font-semibold text-sm hover:brightness-110 transition-all cursor-pointer"
        onClick={onAdd}
      >
        Record Your First Dividend
      </button>
    </div>
  )
}

export function DividendsView() {
  const { dividends, isLoading: dividendsLoading } = useDividends()
  const { summary, isLoading: summaryLoading } = useDividendSummary()
  const deleteDividend = useDividendStore((s) => s.deleteDividend)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current)
      }
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (deleteConfirmId === id) {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current)
        deleteTimerRef.current = null
      }
      try {
        await deleteDividend(id)
      } catch {
        // Error thrown by store
      }
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(id)
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current)
      }
      deleteTimerRef.current = setTimeout(() => {
        setDeleteConfirmId(null)
        deleteTimerRef.current = null
      }, 3000)
    }
  }, [deleteConfirmId, deleteDividend])

  const hasDividends = dividends.length > 0

  if (!hasDividends && !dividendsLoading) {
    return (
      <>
        <EmptyState onAdd={() => setModalOpen(true)} />
        <AddDividendModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sv-text">Dividend Income</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sv-positive text-white text-sm font-medium hover:brightness-110 transition-all cursor-pointer"
        >
          <PlusIcon />
          Record Dividend
        </button>
      </div>

      <DividendSummaryCards summary={summary} isLoading={summaryLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DividendIncomeChart dividends={dividends} />
        </div>
        <div>
          <UpcomingDividends />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-sv-text mb-2">Payment History</h2>
        <DividendHistoryTable
          dividends={dividends}
          isLoading={dividendsLoading}
          onDelete={handleDelete}
        />
      </div>

      <AddDividendModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
