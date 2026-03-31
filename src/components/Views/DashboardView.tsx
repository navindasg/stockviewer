import { useAppStore } from '../../stores/appStore'
import { usePositions } from '../../hooks/usePositions'
import { PortfolioSummary } from '../Portfolio/PortfolioSummary'
import { AllocationChart } from '../Portfolio/AllocationChart'
import { PerformanceBar } from '../Portfolio/PerformanceBar'
import { PositionList } from '../Positions/PositionList'
import { FilterBar } from '../Filters/FilterBar'

function EmptyState() {
  const setModalOpen = useAppStore((s) => s.setModalOpen)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-sv-text mb-2">
          No positions yet
        </h2>
        <p className="text-sm text-sv-text-muted max-w-sm">
          Add your first stock transaction to start tracking your portfolio
          performance.
        </p>
      </div>
      <button
        type="button"
        className="px-6 py-3 rounded-lg bg-sv-accent text-white font-semibold text-sm hover:brightness-110 transition-all"
        onClick={() => setModalOpen(true)}
      >
        Add Your First Position
      </button>
    </div>
  )
}

export function DashboardView() {
  const { positions, filteredPositions, isLoading } = usePositions()
  const quotes = useAppStore((s) => s.quotes)

  const hasPositions = positions.length > 0

  if (!hasPositions && !isLoading) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <FilterBar />

      <PortfolioSummary filteredPositions={filteredPositions} quotes={quotes} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AllocationChart positions={filteredPositions} quotes={quotes} />
        </div>
        <div>
          <PerformanceBar positions={filteredPositions} quotes={quotes} />
        </div>
      </div>

      <PositionList positions={filteredPositions} quotes={quotes} />
    </div>
  )
}
