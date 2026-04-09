import { useState, useRef, useEffect, useCallback } from 'react'
import { usePortfolioStore } from '../../stores/portfolioStore'

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5L6.5 4H11.5C12.05 4 12.5 4.45 12.5 5V10.5C12.5 11.05 12.05 11.5 11.5 11.5H2.5C1.95 11.5 1.5 11.05 1.5 10.5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PortfolioSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const portfolios = usePortfolioStore((s) => s.portfolios)
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId)
  const setActivePortfolioId = usePortfolioStore((s) => s.setActivePortfolioId)

  const activePortfolio = activePortfolioId !== null
    ? portfolios.find((p) => p.id === activePortfolioId)
    : null

  const displayName = activePortfolio ? activePortfolio.name : 'All Portfolios'

  const handleSelect = useCallback((id: number | null) => {
    setActivePortfolioId(id)
    setIsOpen(false)
  }, [setActivePortfolioId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="
          flex items-center gap-1.5 px-2.5 py-1 rounded-md
          text-sm font-medium text-sv-text-secondary
          hover:text-sv-text hover:bg-sv-elevated
          transition-colors duration-150 cursor-pointer
          border border-sv-border
        "
      >
        <FolderIcon />
        <span className="max-w-[140px] truncate">{displayName}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="
          absolute top-full left-0 mt-1 z-50
          min-w-[200px] max-w-[280px]
          bg-sv-elevated border border-sv-border rounded-lg shadow-xl
          py-1 overflow-hidden
        ">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`
              flex items-center justify-between w-full px-3 py-2 text-sm
              transition-colors duration-100 cursor-pointer
              ${activePortfolioId === null
                ? 'text-sv-accent bg-sv-accent/10'
                : 'text-sv-text hover:bg-sv-surface'
              }
            `}
          >
            <span className="font-medium">All Portfolios</span>
            {activePortfolioId === null && <CheckIcon />}
          </button>

          {portfolios.length > 0 && (
            <div className="border-t border-sv-border my-1" />
          )}

          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              type="button"
              onClick={() => handleSelect(portfolio.id)}
              className={`
                flex items-center justify-between w-full px-3 py-2 text-sm
                transition-colors duration-100 cursor-pointer
                ${activePortfolioId === portfolio.id
                  ? 'text-sv-accent bg-sv-accent/10'
                  : 'text-sv-text hover:bg-sv-surface'
                }
              `}
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="font-medium truncate max-w-[200px]">
                  {portfolio.name}
                  {portfolio.isDefault && (
                    <span className="ml-1.5 text-[10px] text-sv-text-muted font-normal">(default)</span>
                  )}
                </span>
                {portfolio.description && (
                  <span className="text-xs text-sv-text-muted truncate max-w-[200px]">
                    {portfolio.description}
                  </span>
                )}
              </div>
              {activePortfolioId === portfolio.id && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
