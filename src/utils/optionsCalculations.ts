import type { OptionPosition, Quote, PortfolioGreeks } from '../types/index'

interface OptionPnLResult {
  readonly unrealizedPnl: number
  readonly realizedPnl: number
  readonly totalPnl: number
  readonly unrealizedPercent: number
  readonly currentMarketValue: number
  readonly costBasis: number
}

/**
 * Computes the full P&L breakdown for a single option position.
 * For open positions: uses current market price to calculate unrealized.
 * For closed positions: returns realized P&L only.
 */
export function computeOptionPnL(
  position: OptionPosition,
  currentOptionPrice?: number
): OptionPnLResult {
  const { openContracts, avgCostPerContract, contractMultiplier, realizedPnl, status } = position

  if (status !== 'OPEN' || openContracts === 0) {
    return {
      unrealizedPnl: 0,
      realizedPnl,
      totalPnl: realizedPnl,
      unrealizedPercent: 0,
      currentMarketValue: 0,
      costBasis: 0
    }
  }

  const costBasis = avgCostPerContract * openContracts
  const currentMarketValue = (currentOptionPrice ?? 0) * openContracts * contractMultiplier
  const unrealizedPnl = currentMarketValue - costBasis

  const unrealizedPercent = costBasis > 0
    ? (unrealizedPnl / costBasis) * 100
    : 0

  return {
    unrealizedPnl,
    realizedPnl,
    totalPnl: unrealizedPnl + realizedPnl,
    unrealizedPercent,
    currentMarketValue,
    costBasis
  }
}

/**
 * Aggregates P&L across all option positions.
 */
export function computeOptionsPortfolioSummary(
  positions: ReadonlyArray<OptionPosition>,
  quotes: Readonly<Record<string, Quote>>
): {
  readonly totalMarketValue: number
  readonly totalCost: number
  readonly totalUnrealizedPnl: number
  readonly totalRealizedPnl: number
  readonly totalPnl: number
  readonly openPositionCount: number
  readonly closedPositionCount: number
} {
  let totalMarketValue = 0
  let totalCost = 0
  let totalUnrealizedPnl = 0
  let totalRealizedPnl = 0
  let openPositionCount = 0
  let closedPositionCount = 0

  for (const pos of positions) {
    const quote = quotes[pos.underlyingTicker]
    // Note: underlying quote price is a proxy; actual option price requires chain data
    const pnl = computeOptionPnL(pos, quote?.price)

    totalMarketValue += pnl.currentMarketValue
    totalCost += pnl.costBasis
    totalUnrealizedPnl += pnl.unrealizedPnl
    totalRealizedPnl += pnl.realizedPnl

    if (pos.status === 'OPEN') {
      openPositionCount += 1
    } else {
      closedPositionCount += 1
    }
  }

  return {
    totalMarketValue,
    totalCost,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalPnl: totalUnrealizedPnl + totalRealizedPnl,
    openPositionCount,
    closedPositionCount
  }
}

/**
 * Aggregates greeks across all open option positions.
 * Greeks are sourced from options chain data when available.
 */
export function computePortfolioGreeks(
  positions: ReadonlyArray<OptionPosition>,
  greeksMap: Readonly<Record<string, { delta: number; gamma: number; theta: number; vega: number }>>
): PortfolioGreeks {
  let totalDelta = 0
  let totalGamma = 0
  let totalTheta = 0
  let totalVega = 0
  let positionCount = 0

  for (const pos of positions) {
    if (pos.status !== 'OPEN') continue

    const greeks = greeksMap[pos.occSymbol]
    if (!greeks) continue

    const multiplier = pos.direction === 'SHORT' ? -1 : 1
    const contracts = pos.openContracts

    totalDelta += greeks.delta * contracts * multiplier
    totalGamma += greeks.gamma * contracts * multiplier
    totalTheta += greeks.theta * contracts * multiplier
    totalVega += greeks.vega * contracts * multiplier
    positionCount += 1
  }

  return {
    totalDelta,
    totalGamma,
    totalTheta,
    totalVega,
    positionCount
  }
}
