import { useAppStore, type ViewName } from '../../stores/appStore'

interface NavItem {
  readonly id: ViewName
  readonly label: string
  readonly icon: React.ReactNode
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function PositionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="16" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="15" width="16" height="2" rx="1" fill="currentColor" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="5" cy="10" r="1.5" fill="currentColor" />
      <circle cx="5" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

function CompareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 16V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 16V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 16V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TransactionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h14M3 10h14M3 15h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ClosedTradesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function WatchlistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 4C5 4 2 10 2 10C2 10 5 16 10 16C15 16 18 10 18 10C18 10 15 4 10 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-150 ease-in-out ${collapsed ? 'rotate-180' : ''}`}
    >
      <path
        d="M12 4L6 10L12 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DividendsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 6H8.5a2.5 2.5 0 000 5h3a2.5 2.5 0 010 5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'position-detail', label: 'Positions', icon: <PositionsIcon /> },
  { id: 'compare', label: 'Compare', icon: <CompareIcon /> },
  { id: 'transactions', label: 'Transactions', icon: <TransactionsIcon /> },
  { id: 'dividends', label: 'Dividends', icon: <DividendsIcon /> },
  { id: 'closed-positions', label: 'Closed Trades', icon: <ClosedTradesIcon /> },
  { id: 'watchlist', label: 'Watchlist', icon: <WatchlistIcon /> }
]

export function Sidebar() {
  const activeView = useAppStore((state) => state.activeView)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)

  return (
    <nav
      className="flex flex-col bg-sv-surface border-r border-sv-border transition-all duration-150 ease-in-out h-full"
      style={{ width: sidebarCollapsed ? 56 : 220 }}
    >
      <div className="flex-1 pt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`
                flex items-center w-full h-10 gap-3 px-4
                transition-colors duration-150 ease-in-out
                border-l-3 cursor-pointer
                ${isActive
                  ? 'border-l-sv-accent bg-sv-elevated text-sv-text'
                  : 'border-l-transparent text-sv-text-secondary hover:bg-sv-elevated/50 hover:text-sv-text'
                }
              `}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={toggleSidebar}
        className="
          flex items-center justify-center w-full h-10 mb-2
          text-sv-text-muted hover:text-sv-text-secondary
          transition-colors duration-150 ease-in-out cursor-pointer
        "
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <CollapseIcon collapsed={sidebarCollapsed} />
      </button>
    </nav>
  )
}
