import { getDatabase } from './database'
import type { TaxReportRow, TaxReportSummary } from '../../src/types/index'

interface ReportQueryRow {
  readonly ticker: string
  readonly acquisition_date: string
  readonly shares_consumed: number
  readonly cost_per_share: number
  readonly proceeds_per_share: number
  readonly realized_gain: number
  readonly is_short_term: number
  readonly is_wash_sale: number
  readonly wash_sale_adjustment: number
  readonly sell_date: string
  readonly company_name: string | null
}

function buildDescription(ticker: string, shares: number): string {
  return `${shares} sh ${ticker}`
}

function buildAdjustmentCode(isWashSale: boolean): string {
  return isWashSale ? 'W' : ''
}

export function generateTaxReport(year?: number): TaxReportSummary {
  const db = getDatabase()

  let dateFilter = ''
  const params: unknown[] = []

  if (year !== undefined) {
    dateFilter = 'AND t.date >= ? AND t.date < ?'
    params.push(`${year}-01-01T00:00:00.000Z`)
    params.push(`${year + 1}-01-01T00:00:00.000Z`)
  }

  const rows = db.prepare(`
    SELECT
      tl.ticker,
      tl.acquisition_date,
      la.shares_consumed,
      la.cost_per_share,
      la.proceeds_per_share,
      la.realized_gain,
      la.is_short_term,
      la.is_wash_sale,
      la.wash_sale_adjustment,
      t.date as sell_date,
      tm.company_name
    FROM lot_assignments la
    JOIN tax_lots tl ON la.tax_lot_id = tl.id
    JOIN transactions t ON la.sell_transaction_id = t.id
    LEFT JOIN ticker_metadata tm ON tl.ticker = tm.ticker
    WHERE 1=1 ${dateFilter}
    ORDER BY t.date ASC, tl.acquisition_date ASC
  `).all(...params) as ReportQueryRow[]

  let totalShortTermGain = 0
  let totalLongTermGain = 0
  let totalWashSaleAdjustment = 0
  let totalProceeds = 0
  let totalCostBasis = 0
  let totalGainOrLoss = 0

  const reportRows: TaxReportRow[] = rows.map((row) => {
    const proceeds = row.shares_consumed * row.proceeds_per_share
    const costBasis = row.shares_consumed * row.cost_per_share
    const isShortTerm = row.is_short_term === 1
    const isWashSale = row.is_wash_sale === 1

    totalProceeds += proceeds
    totalCostBasis += costBasis
    totalGainOrLoss += row.realized_gain
    totalWashSaleAdjustment += row.wash_sale_adjustment

    if (isShortTerm) {
      totalShortTermGain += row.realized_gain
    } else {
      totalLongTermGain += row.realized_gain
    }

    return {
      ticker: row.ticker,
      companyName: row.company_name ?? row.ticker,
      description: buildDescription(row.ticker, row.shares_consumed),
      dateAcquired: row.acquisition_date,
      dateSold: row.sell_date,
      proceeds,
      costBasis,
      adjustmentCode: buildAdjustmentCode(isWashSale),
      adjustmentAmount: row.wash_sale_adjustment,
      gainOrLoss: row.realized_gain,
      isShortTerm,
      isWashSale
    }
  })

  return {
    rows: reportRows,
    totalShortTermGain,
    totalLongTermGain,
    totalWashSaleAdjustment,
    totalProceeds,
    totalCostBasis,
    totalGainOrLoss
  }
}

export function generateTaxReportCsv(year?: number): string {
  const report = generateTaxReport(year)

  const headers = [
    'Description of Property',
    'Date Acquired',
    'Date Sold',
    'Proceeds',
    'Cost or Other Basis',
    'Adjustment Code',
    'Adjustment Amount',
    'Gain or (Loss)',
    'Term',
    'Wash Sale'
  ]

  const escapeCell = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const formatMoney = (value: number): string => value.toFixed(2)
  const formatDate = (isoDate: string): string => {
    const d = new Date(isoDate)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const yr = d.getFullYear()
    return `${month}/${day}/${yr}`
  }

  const lines: string[] = [headers.join(',')]

  for (const row of report.rows) {
    const cells = [
      escapeCell(row.description),
      formatDate(row.dateAcquired),
      formatDate(row.dateSold),
      formatMoney(row.proceeds),
      formatMoney(row.costBasis),
      row.adjustmentCode,
      formatMoney(row.adjustmentAmount),
      formatMoney(row.gainOrLoss),
      row.isShortTerm ? 'Short-Term' : 'Long-Term',
      row.isWashSale ? 'Yes' : 'No'
    ]
    lines.push(cells.join(','))
  }

  lines.push('')
  lines.push(`Summary,,,,,,,,`)
  lines.push(`Total Short-Term Gain/Loss,,,,,,,,${formatMoney(report.totalShortTermGain)}`)
  lines.push(`Total Long-Term Gain/Loss,,,,,,,,${formatMoney(report.totalLongTermGain)}`)
  lines.push(`Total Wash Sale Adjustments,,,,,,,,${formatMoney(report.totalWashSaleAdjustment)}`)
  lines.push(`Total Proceeds,,,${formatMoney(report.totalProceeds)},,,,`)
  lines.push(`Total Cost Basis,,,,${formatMoney(report.totalCostBasis)},,,`)
  lines.push(`Total Gain/Loss,,,,,,,${formatMoney(report.totalGainOrLoss)}`)

  return lines.join('\n')
}
