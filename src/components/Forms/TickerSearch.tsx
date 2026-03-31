import { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchResult } from '../../types/index'

interface TickerSearchProps {
  readonly value: string
  readonly onChange: (ticker: string) => void
  readonly onSelect: (result: SearchResult) => void
  readonly disabled?: boolean
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-sv-text-muted"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
        className="opacity-75"
      />
    </svg>
  )
}

export function TickerSearch({ value, onChange, onSelect, disabled = false }: TickerSearchProps) {
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const searchTicker = useCallback(async (query: string) => {
    if (query.length < 1) {
      setResults([])
      setIsDropdownOpen(false)
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await window.electronAPI.searchTicker(query)
      setResults(searchResults)
      setIsDropdownOpen(searchResults.length > 0)
      setHighlightedIndex(-1)
    } catch {
      setResults([])
      setIsDropdownOpen(false)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (disabled) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchTicker(value)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value, searchTicker, disabled])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!isDropdownOpen || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault()
      const selected = results[highlightedIndex]
      if (selected) {
        handleSelect(selected)
      }
    }
  }

  function handleSelect(result: SearchResult) {
    onChange(result.ticker)
    onSelect(result)
    setIsDropdownOpen(false)
    setResults([])
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsDropdownOpen(true)
          }}
          disabled={disabled}
          placeholder="Search ticker..."
          className={`
            w-full px-3 py-2 rounded-md font-mono text-sm
            bg-sv-surface border border-sv-border text-sv-text
            placeholder:text-sv-text-muted
            focus:outline-none focus:border-sv-accent focus:ring-1 focus:ring-sv-accent
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          autoComplete="off"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {isDropdownOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-sv-elevated border border-sv-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((result, index) => (
            <li key={`${result.ticker}-${result.exchange}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  w-full px-3 py-2 text-left flex items-center gap-2 cursor-pointer
                  ${highlightedIndex === index
                    ? 'bg-sv-accent/20 text-sv-text'
                    : 'text-sv-text-secondary hover:bg-sv-surface'
                  }
                `}
              >
                <span className="font-mono text-sm font-semibold text-sv-accent min-w-[60px]">
                  {result.ticker}
                </span>
                <span className="text-sm truncate flex-1">{result.name}</span>
                <span className="text-xs text-sv-text-muted">{result.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
