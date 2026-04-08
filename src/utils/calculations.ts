import type { Transaction, Position, Quote, PortfolioSummary } from '../types/index'

interface CostBasisState {
  readonly shares: number
  readonly cost: number
}

interface CostBasisResult {
  readonly state: CostBasisState
  readonly totalRealized: number
  readonly totalInvested: number
  readonly firstBuyDate: string | null
  readonly lastSellDate: string | null
}

function buildCostBasisState(transactions: ReadonlyArray<Transaction>): CostBasisResult {
  const sorted = [...transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
  )

  let shares = 0
  let cost = 0
  let totalRealized = 0
  let totalInvested = 0
  let firstBuyDate: string | null = null
  let lastSellDate: string | null = null

  for (const tx of sorted) {
    if (tx.type === 'BUY') {
      cost += tx.shares * tx.price
      shares += tx.shares
      totalInvested += tx.shares * tx.price
      if (firstBuyDate === null || tx.date < firstBuyDate) {
        firstBuyDate = tx.date
      }
    } else {
      const avgCost = shares > 0 ? cost / shares : 0
      totalRealized += (tx.price - avgCost) * tx.shares
      cost -= avgCost * tx.shares
      shares -= tx.shares
      if (lastSellDate === null || tx.date > lastSellDate) {
        lastSellDate = tx.date
      }
    }
  }

  return {
    state: { shares, cost },
    totalRealized,
    totalInvested,
    firstBuyDate,
    lastSellDate
  }
}

export function computeCostBasis(transactions: ReadonlyArray<Transaction>): number {
  const { state } = buildCostBasisState(transactions)
  return state.shares > 0 ? state.cost / state.shares : 0
}

export function computeRealizedGain(transactions: ReadonlyArray<Transaction>): number {
  const { totalRealized } = buildCostBasisState(transactions)
  return totalRealized
}

export function computePosition(
  transactions: ReadonlyArray<Transaction>,
  companyName?: string,
  color?: string
): Position {
  if (transactions.length === 0) {
    throw new Error('Cannot compute position from empty transactions')
  }

  const ticker = transactions[0].ticker
  const { state, totalRealized, totalInvested, firstBuyDate, lastSellDate } = buildCostBasisState(transactions)
  const costBasis = state.shares > 0 ? state.cost / state.shares : 0

  return {
    ticker,
    companyName: companyName ?? ticker,
    totalShares: state.shares,
    costBasis,
    totalInvested,
    totalRealized,
    status: state.shares > 0 ? 'OPEN' : 'CLOSED',
    color: color ?? '#3B82F6',
    firstBuyDate,
    lastSellDate
  }
}

export function computePortfolioSummary(
  positions: ReadonlyArray<Position>,
  quotes: ReadonlyArray<Quote>
): PortfolioSummary {
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]))

  let totalValue = 0
  let totalCost = 0
  let totalDayChange = 0
  let totalRealizedGain = 0
  let positionCount = 0

  for (const pos of positions) {
    if (pos.status === 'CLOSED') {
      totalRealizedGain += pos.totalRealized
      continue
    }

    positionCount += 1
    const quote = quoteMap.get(pos.ticker)
    const currentPrice = quote?.price ?? pos.costBasis
    const previousClose = quote?.previousClose ?? currentPrice

    const marketValue = currentPrice * pos.totalShares
    const costValue = pos.costBasis * pos.totalShares
    const dayChange = (currentPrice - previousClose) * pos.totalShares

    totalValue += marketValue
    totalCost += costValue
    totalDayChange += dayChange
    totalRealizedGain += pos.totalRealized
  }

  const totalUnrealizedGain = totalValue - totalCost
  const totalUnrealizedGainPercent = totalCost > 0 ? (totalUnrealizedGain / totalCost) * 100 : 0
  const totalDayChangePercent =
    totalValue - totalDayChange > 0
      ? (totalDayChange / (totalValue - totalDayChange)) * 100
      : 0
  const totalReturn = totalUnrealizedGain + totalRealizedGain
  const totalInvestedAll = positions.reduce((sum, p) => sum + p.totalInvested, 0)
  const totalReturnPercent = totalInvestedAll > 0 ? (totalReturn / totalInvestedAll) * 100 : 0

  return {
    totalValue,
    totalCost,
    totalDayChange,
    totalDayChangePercent,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    totalRealizedGain,
    totalReturn,
    totalReturnPercent,
    positionCount
  }
}
