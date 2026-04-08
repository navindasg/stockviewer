import { format, parseISO } from 'date-fns'
import type { OptionType } from '../types/options'

/**
 * Builds a standard OCC option symbol.
 * Format: TICKER + YYMMDD + C/P + strike price padded to 8 digits (price * 1000)
 * Example: AAPL240119C00150000 = AAPL Jan 19 2024 $150 Call
 */
export function buildOccSymbol(
  ticker: string,
  expirationDate: string,
  optionType: OptionType,
  strikePrice: number
): string {
  const upperTicker = ticker.toUpperCase()
  const expDate = parseISO(expirationDate)
  const dateStr = format(expDate, 'yyMMdd')
  const typeChar = optionType === 'CALL' ? 'C' : 'P'
  const strikePadded = Math.round(strikePrice * 1000)
    .toString()
    .padStart(8, '0')

  return `${upperTicker}${dateStr}${typeChar}${strikePadded}`
}

interface ParsedOccSymbol {
  readonly ticker: string
  readonly expirationDate: string
  readonly optionType: OptionType
  readonly strikePrice: number
}

/**
 * Parses a standard OCC option symbol back to its components.
 * Handles variable-length ticker symbols (1-6 chars).
 */
export function parseOccSymbol(occSymbol: string): ParsedOccSymbol {
  // OCC format: TICKER(1-6 chars) + YYMMDD(6) + C/P(1) + strike(8)
  // The last 15 chars are always date + type + strike
  const suffix = occSymbol.slice(-15)
  const ticker = occSymbol.slice(0, -15)

  if (ticker.length === 0 || ticker.length > 6) {
    throw new Error(`Invalid OCC symbol: ${occSymbol}`)
  }

  const dateStr = suffix.slice(0, 6)
  const typeChar = suffix.slice(6, 7)
  const strikeStr = suffix.slice(7)

  const year = 2000 + parseInt(dateStr.slice(0, 2), 10)
  const month = parseInt(dateStr.slice(2, 4), 10)
  const day = parseInt(dateStr.slice(4, 6), 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid OCC symbol date: ${occSymbol}`)
  }

  const expirationDate = format(new Date(year, month - 1, day), 'yyyy-MM-dd')

  if (typeChar !== 'C' && typeChar !== 'P') {
    throw new Error(`Invalid OCC symbol option type: ${occSymbol}`)
  }

  const optionType: OptionType = typeChar === 'C' ? 'CALL' : 'PUT'
  const strikePrice = parseInt(strikeStr, 10) / 1000

  if (isNaN(strikePrice) || strikePrice <= 0) {
    throw new Error(`Invalid OCC symbol strike price: ${occSymbol}`)
  }

  return { ticker, expirationDate, optionType, strikePrice }
}

/**
 * Formats an OCC symbol for human-readable display.
 * Example: "AAPL240119C00150000" → "AAPL Jan 19 '24 $150 Call"
 */
export function formatOccSymbol(occSymbol: string): string {
  try {
    const parsed = parseOccSymbol(occSymbol)
    const expDate = parseISO(parsed.expirationDate)
    const dateFormatted = format(expDate, "MMM d ''yy")
    const typeLabel = parsed.optionType === 'CALL' ? 'Call' : 'Put'
    return `${parsed.ticker} ${dateFormatted} $${parsed.strikePrice} ${typeLabel}`
  } catch {
    return occSymbol
  }
}
