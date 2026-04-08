import { useState, useEffect, useCallback } from 'react'
import { useOptionsStore } from '../../stores/optionsStore'
import { AddOptionTransactionModal } from '../Forms/AddOptionTransactionModal'
import { formatCurrency } from '../../utils/formatters'
import type { OptionsChainContract, OptionType, OptionAction } from '../../types/index'

interface OptionsChainViewProps {
  readonly initialTicker?: string
}

interface PrefillState {
  readonly ticker: string
  readonly optionType: OptionType
  readonly strike: number
  readonly expiration: string
  readonly action: OptionAction
}

function formatIV(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`
}

function formatVolume(vol: number): string {
  if (vol >= 1000) {
    return `${(vol / 1000).toFixed(1)}K`
  }
  return vol.toString()
}

export function OptionsChainView({ initialTicker }: OptionsChainViewProps) {
  const [ticker, setTicker] = useState(initialTicker ?? '')
  const [searchInput, setSearchInput] = useState(initialTicker ?? '')
  const [selectedExpIdx, setSelectedExpIdx] = useState(0)
  const [prefill, setPrefill] = useState<PrefillState | null>(null)

  const optionsChain = useOptionsStore((s) => s.optionsChain)
  const optionsChainLoading = useOptionsStore((s) => s.optionsChainLoading)
  const fetchOptionsChain = useOptionsStore((s) => s.fetchOptionsChain)

  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker)
      setSearchInput(initialTicker)
      fetchOptionsChain(initialTicker).catch(() => {})
    }
  }, [initialTicker, fetchOptionsChain])

  const handleSearch = useCallback(() => {
    const t = searchInput.trim().toUpperCase()
    if (t.length > 0) {
      setTicker(t)
      setSelectedExpIdx(0)
      fetchOptionsChain(t).catch(() => {})
    }
  }, [searchInput, fetchOptionsChain])

  function handleExpirationChange(idx: number) {
    setSelectedExpIdx(idx)
    if (optionsChain && optionsChain.expirations[idx]) {
      fetchOptionsChain(ticker, optionsChain.expirations[idx]).catch(() => {})
    }
  }

  function handleContractClick(contract: OptionsChainContract, optionType: OptionType) {
    if (!optionsChain) return
    const expiration = optionsChain.expirations[selectedExpIdx] ?? ''
    setPrefill({
      ticker,
      optionType,
      strike: contract.strike,
      expiration,
      action: 'BUY_TO_OPEN'
    })
  }

  const chain = optionsChain?.selectedExpiration

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Enter ticker (e.g. AAPL)"
            className="flex-1 px-3 py-2 rounded-md text-sm bg-sv-surface border border-sv-border text-sv-text placeholder:text-sv-text-muted focus:outline-none focus:border-sv-accent focus:ring-1 focus:ring-sv-accent font-mono"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={optionsChainLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-sv-accent rounded-md hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {optionsChainLoading ? 'Loading...' : 'Load Chain'}
          </button>
        </div>
        {optionsChain && (
          <div className="text-sm text-sv-text-secondary">
            <span className="font-medium text-sv-text">{optionsChain.underlyingTicker}</span>
            {' '}
            <span className="font-mono tabular-nums text-sv-accent">
              {formatCurrency(optionsChain.underlyingPrice)}
            </span>
          </div>
        )}
      </div>

      {/* Expiration tabs */}
      {optionsChain && optionsChain.expirations.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <span className="text-xs text-sv-text-muted mr-2 flex-shrink-0">Exp:</span>
          {optionsChain.expirations.slice(0, 12).map((exp, idx) => (
            <button
              key={exp}
              type="button"
              onClick={() => handleExpirationChange(idx)}
              className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors cursor-pointer ${
                selectedExpIdx === idx
                  ? 'bg-sv-accent text-white'
                  : 'bg-sv-surface text-sv-text-secondary border border-sv-border hover:text-sv-text'
              }`}
            >
              {exp}
            </button>
          ))}
        </div>
      )}

      {/* Chain table */}
      {optionsChainLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sv-text-muted text-sm">Loading options chain...</p>
        </div>
      )}

      {!optionsChainLoading && !chain && ticker && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sv-text-muted text-sm">No options data available for {ticker}</p>
        </div>
      )}

      {!optionsChainLoading && !ticker && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sv-text-muted text-sm">Enter a ticker symbol to view its options chain</p>
        </div>
      )}

      {chain && !optionsChainLoading && (
        <div className="bg-sv-surface rounded-lg border border-sv-border overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-sv-border">
            {/* Calls */}
            <div>
              <div className="bg-sv-positive/10 px-3 py-2 border-b border-sv-border">
                <h3 className="text-sm font-semibold text-sv-positive">CALLS</h3>
              </div>
              <ChainTable
                contracts={chain.calls}
                optionType="CALL"
                underlyingPrice={optionsChain?.underlyingPrice ?? 0}
                onContractClick={handleContractClick}
                isCall={true}
              />
            </div>
            {/* Puts */}
            <div>
              <div className="bg-sv-negative/10 px-3 py-2 border-b border-sv-border">
                <h3 className="text-sm font-semibold text-sv-negative">PUTS</h3>
              </div>
              <ChainTable
                contracts={chain.puts}
                optionType="PUT"
                underlyingPrice={optionsChain?.underlyingPrice ?? 0}
                onContractClick={handleContractClick}
                isCall={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick-add modal from chain click */}
      {prefill && (
        <AddOptionTransactionModal
          isOpen={true}
          onClose={() => setPrefill(null)}
          prefillTicker={prefill.ticker}
          prefillOptionType={prefill.optionType}
          prefillStrike={prefill.strike}
          prefillExpiration={prefill.expiration}
          prefillAction={prefill.action}
        />
      )}
    </div>
  )
}

interface ChainTableProps {
  readonly contracts: ReadonlyArray<OptionsChainContract>
  readonly optionType: OptionType
  readonly underlyingPrice: number
  readonly onContractClick: (contract: OptionsChainContract, optionType: OptionType) => void
  readonly isCall: boolean
}

function ChainTable({ contracts, optionType, underlyingPrice, onContractClick, isCall }: ChainTableProps) {
  if (contracts.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-sv-text-muted">
        No contracts available
      </div>
    )
  }

  return (
    <table className="w-full">
      <thead className="bg-sv-elevated border-b border-sv-border">
        <tr>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">Strike</th>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">Last</th>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">Bid</th>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">Ask</th>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">Vol</th>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">OI</th>
          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-sv-text-muted uppercase">IV</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-sv-border/50">
        {contracts.map((contract) => {
          const itm = isCall
            ? contract.strike < underlyingPrice
            : contract.strike > underlyingPrice
          const atm = Math.abs(contract.strike - underlyingPrice) / underlyingPrice < 0.01

          return (
            <tr
              key={contract.contractSymbol}
              onClick={() => onContractClick(contract, optionType)}
              className={`cursor-pointer transition-colors hover:bg-sv-elevated ${
                atm
                  ? 'bg-sv-accent/10 border-l-2 border-l-sv-accent'
                  : itm
                    ? 'bg-sv-elevated/30'
                    : ''
              }`}
              title="Click to trade this contract"
            >
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text font-medium">
                {contract.strike.toFixed(2)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text">
                {contract.lastPrice.toFixed(2)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text-secondary">
                {contract.bid.toFixed(2)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text-secondary">
                {contract.ask.toFixed(2)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text-muted">
                {formatVolume(contract.volume)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text-muted">
                {formatVolume(contract.openInterest)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-xs text-sv-text-muted">
                {formatIV(contract.impliedVolatility)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
