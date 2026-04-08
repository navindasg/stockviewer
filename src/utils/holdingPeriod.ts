/**
 * Determine if a holding is short-term per IRS rules.
 * Holding period starts the day after acquisition.
 * Must hold for MORE than one year for long-term treatment.
 */
export function isShortTermHolding(acquisitionDate: string, sellOrCurrentDate?: Date): boolean {
  const acquired = new Date(acquisitionDate)
  const reference = sellOrCurrentDate ?? new Date()
  const oneYearLater = new Date(acquired)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  oneYearLater.setDate(oneYearLater.getDate() + 1)
  return reference < oneYearLater
}
