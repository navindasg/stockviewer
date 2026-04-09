// Options trading types

export type AssetType = 'EQUITY' | 'OPTION'
export type OptionType = 'CALL' | 'PUT'
export type OptionAction =
  | 'BUY_TO_OPEN'
  | 'SELL_TO_CLOSE'
  | 'SELL_TO_OPEN'
  | 'BUY_TO_CLOSE'
  | 'EXERCISE'
  | 'ASSIGNMENT'
  | 'EXPIRE'

export type OptionPositionStatus = 'OPEN' | 'CLOSED' | 'EXPIRED'

export interface OptionTransaction {
  readonly id: string
  readonly ticker: string
  readonly assetType: 'OPTION'
  readonly type: 'BUY' | 'SELL'
  readonly optionAction: OptionAction
  readonly optionType: OptionType
  readonly strikePrice: number
  readonly expirationDate: string
  readonly contractMultiplier: number
  readonly shares: number // number of contracts
  readonly price: number // premium per share (not per contract)
  readonly date: string
  readonly fees: number
  readonly notes: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface NewOptionTransaction {
  readonly ticker: string
  readonly optionAction: OptionAction
  readonly optionType: OptionType
  readonly strikePrice: number
  readonly expirationDate: string
  readonly contracts: number
  readonly price: number // premium per share
  readonly date: string
  readonly fees?: number
  readonly notes?: string
  readonly portfolioId?: number
}

export interface OptionPosition {
  readonly occSymbol: string
  readonly underlyingTicker: string
  readonly optionType: OptionType
  readonly strikePrice: number
  readonly expirationDate: string
  readonly contractMultiplier: number
  readonly openContracts: number
  readonly avgCostPerContract: number
  readonly totalPremiumPaid: number
  readonly totalPremiumReceived: number
  readonly realizedPnl: number
  readonly status: OptionPositionStatus
  readonly isExpired: boolean
  readonly daysToExpiration: number
  readonly direction: 'LONG' | 'SHORT'
  readonly firstTradeDate: string | null
  readonly lastTradeDate: string | null
  readonly companyName: string
}

export interface OptionPositionFilters {
  readonly ticker?: string
  readonly status?: OptionPositionStatus
  readonly optionType?: OptionType
  readonly portfolioId?: number
}

export interface OptionsChainContract {
  readonly contractSymbol: string
  readonly strike: number
  readonly lastPrice: number
  readonly bid: number
  readonly ask: number
  readonly volume: number
  readonly openInterest: number
  readonly impliedVolatility: number
  readonly inTheMoney: boolean
  readonly lastTradeDate: string | null
  readonly percentChange: number
  readonly delta: number | null
  readonly gamma: number | null
  readonly theta: number | null
  readonly vega: number | null
}

export interface OptionsChainExpiration {
  readonly date: string
  readonly calls: ReadonlyArray<OptionsChainContract>
  readonly puts: ReadonlyArray<OptionsChainContract>
}

export interface OptionsChainData {
  readonly underlyingTicker: string
  readonly underlyingPrice: number
  readonly expirations: ReadonlyArray<string>
  readonly selectedExpiration: OptionsChainExpiration | null
}

export interface PositionGreeks {
  readonly delta: number | null
  readonly gamma: number | null
  readonly theta: number | null
  readonly vega: number | null
}

export interface PortfolioGreeks {
  readonly totalDelta: number
  readonly totalGamma: number
  readonly totalTheta: number
  readonly totalVega: number
  readonly positionCount: number
}
