import { useEffect, useState } from 'react'
import { useOptionsStore } from '../../stores/optionsStore'
import { useAppStore } from '../../stores/appStore'
import { AddOptionTransactionModal } from '../Forms/AddOptionTransactionModal'
import { OptionsPositionList } from '../Options/OptionsPositionList'
import { OptionsChainView } from '../Options/OptionsChainView'
import { PortfolioGreeksSummary } from '../Options/PortfolioGreeksSummary'
import type { OptionPositionStatus } from '../../types/index'

type OptionsTab = 'positions' | 'chain'

export function OptionsView() {
  const [activeTab, setActiveTab] = useState<OptionsTab>('positions')
  const [statusFilter, setStatusFilter] = useState<OptionPositionStatus | 'ALL'>('ALL')
  const [chainTicker, setChainTicker] = useState('')

  const optionPositions = useOptionsStore((s) => s.optionPositions)
  const optionPositionsLoading = useOptionsStore((s) => s.optionPositionsLoading)
  const fetchOptionPositions = useOptionsStore((s) => s.fetchOptionPositions)
  const optionModalOpen = useOptionsStore((s) => s.optionModalOpen)
  const setOptionModalOpen = useOptionsStore((s) => s.setOptionModalOpen)
  const quotes = useAppStore((s) => s.quotes)

  useEffect(() => {
    const filters = statusFilter === 'ALL' ? undefined : { status: statusFilter }
    fetchOptionPositions(filters).catch(() => {
      // Error handled by store
    })
  }, [fetchOptionPositions, statusFilter])

  const openPositions = optionPositions.filter((p) => p.status === 'OPEN')

  function handleViewChain(ticker: string) {
    setChainTicker(ticker)
    setActiveTab('chain')
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-sv-text">Options</h1>
          <div className="flex rounded-md overflow-hidden border border-sv-border">
            <button
              type="button"
              onClick={() => setActiveTab('positions')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'positions'
                  ? 'bg-sv-accent text-white'
                  : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
              }`}
            >
              Positions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chain')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'chain'
                  ? 'bg-sv-accent text-white'
                  : 'bg-sv-surface text-sv-text-secondary hover:text-sv-text'
              }`}
            >
              Chain Viewer
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOptionModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-sv-accent rounded-md hover:brightness-110 transition-all cursor-pointer"
        >
          + Add Option Trade
        </button>
      </div>

      {activeTab === 'positions' && (
        <>
          {/* Portfolio Greeks Summary */}
          {openPositions.length > 0 && (
            <PortfolioGreeksSummary positions={openPositions} quotes={quotes} />
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-sv-text-secondary">Status:</span>
            {(['ALL', 'OPEN', 'CLOSED', 'EXPIRED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-sv-accent text-white'
                    : 'bg-sv-surface text-sv-text-secondary border border-sv-border hover:text-sv-text'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Position List */}
          {optionPositionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sv-text-muted text-sm">Loading options positions...</p>
            </div>
          ) : optionPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <h2 className="text-lg font-semibold text-sv-text">No options positions</h2>
              <p className="text-sm text-sv-text-muted max-w-sm text-center">
                Add your first options trade to start tracking contracts, premiums, and P&L.
              </p>
              <button
                type="button"
                onClick={() => setOptionModalOpen(true)}
                className="px-6 py-3 rounded-lg bg-sv-accent text-white font-semibold text-sm hover:brightness-110 transition-all cursor-pointer"
              >
                Add Option Trade
              </button>
            </div>
          ) : (
            <OptionsPositionList
              positions={optionPositions}
              quotes={quotes}
              onViewChain={handleViewChain}
            />
          )}
        </>
      )}

      {activeTab === 'chain' && (
        <OptionsChainView initialTicker={chainTicker} />
      )}

      <AddOptionTransactionModal
        isOpen={optionModalOpen}
        onClose={() => setOptionModalOpen(false)}
      />
    </div>
  )
}
