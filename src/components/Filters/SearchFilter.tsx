import { useFilters } from '../../hooks/useFilters'

export function SearchFilter() {
  const { filters, setFilter } = useFilters()

  return (
    <div className="relative">
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sv-text-muted pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="text"
        value={filters.searchText}
        onChange={(e) => setFilter('searchText', e.target.value)}
        placeholder="Search ticker or company..."
        className="w-48 pl-8 pr-3 py-1.5 rounded text-sm bg-sv-bg border border-sv-border text-sv-text placeholder:text-sv-text-muted focus:outline-none focus:border-sv-accent transition-colors"
      />
      {filters.searchText !== '' && (
        <button
          type="button"
          onClick={() => setFilter('searchText', '')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sv-text-muted hover:text-sv-text transition-colors"
          aria-label="Clear search"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  )
}
