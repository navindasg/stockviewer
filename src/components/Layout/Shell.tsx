import { useEffect, useCallback } from 'react'
import { useAppStore, type ViewName } from '../../stores/appStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AddTransactionModal } from '../Forms/AddTransactionModal'

function ViewPlaceholder({ name }: { readonly name: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-sv-text mb-1">{name}</h2>
        <p className="text-sv-text-secondary text-sm">View coming soon</p>
      </div>
    </div>
  )
}

function renderView(activeView: ViewName) {
  switch (activeView) {
    case 'dashboard':
      return <ViewPlaceholder name="Dashboard" />
    case 'position-detail':
      return <ViewPlaceholder name="Position Detail" />
    case 'compare':
      return <ViewPlaceholder name="Compare" />
    case 'transactions':
      return <ViewPlaceholder name="Transactions" />
    default:
      return <ViewPlaceholder name="Dashboard" />
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
