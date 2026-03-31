import { useEffect, useCallback } from 'react'
import { useAppStore, type ViewName } from '../../stores/appStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AddTransactionModal } from '../Forms/AddTransactionModal'
import { DashboardView } from '../Views/DashboardView'
import { PositionDetail } from '../Positions/PositionDetail'
import { CompareView } from '../Views/CompareView'
import { TransactionsView } from '../Views/TransactionsView'

function renderView(activeView: ViewName) {
  switch (activeView) {
    case 'dashboard':
      return <DashboardView />
    case 'position-detail':
      return <PositionDetail />
    case 'compare':
      return <CompareView />
    case 'transactions':
      return <TransactionsView />
    default:
      return <DashboardView />
  }
}

export function Shell() {
  const activeView = useAppStore((state) => state.activeView)
  const fetchPositions = useAppStore((state) => state.fetchPositions)
  const fetchQuotes = useAppStore((state) => state.fetchQuotes)
  const positions = useAppStore((state) => state.positions)
  const modalOpen = useAppStore((state) => state.modalOpen)
  const setModalOpen = useAppStore((state) => state.setModalOpen)
  const selectedTicker = useAppStore((state) => state.selectedTicker)

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
  }, [setModalOpen])

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchPositions()
      } catch {
        // Store actions throw with details; positions will remain empty
      }
    }
    loadInitialData()
  }, [fetchPositions])

  useEffect(() => {
    const tickers = positions.map((p) => p.ticker)
    if (tickers.length === 0) return

    const loadQuotes = async () => {
      try {
        await fetchQuotes(tickers)
      } catch {
        // Store actions throw with details; quotes will remain empty
      }
    }
    loadQuotes()
  }, [positions, fetchQuotes])

  return (
    <div className="flex h-screen w-screen bg-sv-bg overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-6 bg-sv-bg">
          {renderView(activeView)}
        </main>
      </div>
      <AddTransactionModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        prefillTicker={activeView === 'position-detail' ? selectedTicker ?? undefined : undefined}
      />
    </div>
  )
}
