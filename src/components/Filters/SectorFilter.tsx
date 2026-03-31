import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useFilters } from '../../hooks/useFilters'

interface SectorOption {
  readonly sector: string
  readonly count: number
}

function useSectorOptions(): ReadonlyArray<SectorOption> {
  const positions = useAppStore((s) => s.positions)
  const quotes = useAppStore((s) => s.quotes)

  return useMemo(() => {
    const sectorCounts = new Map<string, number>()

    for (const pos of positions) {
      const quote = quotes[pos.ticker]
      const sector = quote?.sector
      if (sector) {
        sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1)
      }
    }

    return [...sectorCounts.entries()]
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => a.sector.localeCompare(b.sector))
  }, [positions, quotes])
}

export function SectorFilter() {
  const { filters, setFilter } = useFilters()
  const sectorOptions = useSectorOptions()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedSectors = filters.sectors

  const handleToggleSector = useCallback(
    (sector: string) => {
      const updated = selectedSectors.includes(sector)
        ? selectedSectors.filter((s) => s !== sector)
        : [...selectedSectors, sector]
      setFilter('sectors', updated)
    },
    [selectedSectors, setFilter]
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const buttonLabel =
    selectedSectors.length === 0
      ? 'All Sectors'
      : selectedSectors.length === 1
        ? selectedSectors[0]
        : `${selectedSectors.length} sectors`

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
          selectedSectors.length > 0
            ? 'bg-sv-accent/15 text-sv-accent border-sv-accent/40'
            : 'bg-sv-bg border-sv-border text-sv-text-muted hover:text-sv-text hover:border-sv-text-muted'
        }`}
      >
        {buttonLabel}
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg bg-sv-surface border border-sv-border shadow-lg py-1">
          {sectorOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-sv-text-muted">No sectors available</p>
          ) : (
            sectorOptions.map((opt) => {
              const isSelected = selectedSectors.includes(opt.sector)
              return (
                <button
                  key={opt.sector}
                  type="button"
                  onClick={() => handleToggleSector(opt.sector)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? 'bg-sv-accent/10 text-sv-accent'
                      : 'text-sv-text-secondary hover:bg-sv-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-sv-accent border-sv-accent' : 'border-sv-border'
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-2 w-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    {opt.sector}
                  </span>
                  <span className="text-sv-text-muted font-mono tabular-nums">{opt.count}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
