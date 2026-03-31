const TICKER_PALETTE: ReadonlyArray<string> = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#A855F7', // purple
  '#84CC16', // lime
  '#E11D48', // rose
  '#0EA5E9', // sky
  '#D946EF', // fuchsia
  '#10B981', // emerald
  '#FACC15'  // yellow
]

function hashTicker(ticker: string): number {
  let hash = 5381
  for (let i = 0; i < ticker.length; i++) {
    hash = ((hash << 5) + hash + ticker.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getTickerColor(ticker: string): string {
  const index = hashTicker(ticker) % TICKER_PALETTE.length
  return TICKER_PALETTE[index]
}

export { TICKER_PALETTE }
