import { usePortfolioStore } from '../../stores/portfolioStore'

interface PortfolioSelectProps {
  readonly value: number | undefined
  readonly onChange: (portfolioId: number) => void
}

export function PortfolioSelect({ value, onChange }: PortfolioSelectProps) {
  const portfolios = usePortfolioStore((s) => s.portfolios)
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId)

  const effectiveValue = value ?? activePortfolioId ?? portfolios.find((p) => p.isDefault)?.id

  if (portfolios.length <= 1) {
    return null
  }

  return (
    <div>
      <label className="block text-sm font-medium text-sv-text-secondary mb-1">Portfolio</label>
      <select
        value={effectiveValue ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-md bg-sv-surface border border-sv-border text-sv-text text-sm focus:outline-none focus:border-sv-accent font-mono"
      >
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}{p.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
