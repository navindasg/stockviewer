import { useEffect, useCallback, useRef } from 'react'
import { useAppStore, type ViewName } from '../../stores/appStore'
import { useDividendStore } from '../../stores/dividendStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AddTransactionModal } from '../Forms/AddTransactionModal'
import { DashboardView } from '../Views/DashboardView'
import { PositionDetail } from '../Positions/PositionDetail'
import { CompareView } from '../Views/CompareView'
import { TransactionsView } from '../Views/TransactionsView'
import { ClosedPositionsView } from '../Views/ClosedPositionsView'
import { WatchlistView } from '../Watchlist/WatchlistView'
import { DividendsView } from '../Views/DividendsView'
import { OptionsView } from '../Views/OptionsView'
import { BenchmarkView } from '../Views/BenchmarkView'
import { PortfolioManagerView } from '../Portfolios/PortfolioManagerView'

function renderView(activeView: ViewName) {
  switch (activeView) {
    case 'dashboard':
      return <DashboardView />
    case 'position-detail':
      return <PositionDetail />
    case 'compare':
      return <CompareView />
    case 'benchmark':
      return <BenchmarkView />
    case 'transactions':
      return <TransactionsView />
    case 'closed-positions':
      return <ClosedPositionsView />
    case 'watchlist':
      return <WatchlistView />
    case 'dividends':
      return <DividendsView />
    case 'options':
      return <OptionsView />
    case 'portfolios':
      return <PortfolioManagerView />
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
  const fetchDividendSummary = useDividendStore((state) => state.fetchDividendSummary)
  const fetchPortfolios = usePortfolioStore((state) => state.fetchPortfolios)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
  }, [setModalOpen])

  const handleRefresh = useCallback(async () => {
    try {
      await fetchPositions()
      const tickers = positions.map((p) => p.ticker)
      if (tickers.length > 0) {
        await fetchQuotes(tickers)
      }
    } catch {
      // Error is thrown by store actions; UI will reflect stale state
    }
  }, [fetchPositions, fetchQuotes, positions])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey

      if (isModifier && event.key === 'n') {
        event.preventDefault()
        setModalOpen(true)
        return
      }

      if (isModifier && event.key === 'r') {
        event.preventDefault()
        handleRefresh()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setModalOpen, handleRefresh])

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchPortfolios()
      } catch {
        // Portfolios are best-effort on first load
      }
      try {
        await fetchPositions()
      } catch {
        // Store actions throw with details; positions will remain empty
      }
      try {
        await fetchDividendSummary()
      } catch {
        // Dividend summary is best-effort
      }
    }
    loadInitialData()
  }, [fetchPositions, fetchDividendSummary, fetchPortfolios])

  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const refetchForPortfolio = async () => {
      try {
        await fetchPositions()
      } catch {
        // positions will remain stale
      }
      try {
        await fetchDividendSummary()
      } catch {
        // summary is best-effort
      }
    }
    refetchForPortfolio()
  }, [activePortfolioId, fetchPositions, fetchDividendSummary])

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
