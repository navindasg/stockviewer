# Stock Viewer

Desktop stock portfolio tracker built with Electron, React, and Vite. Bloomberg-inspired dark UI for tracking personal stock positions with real-time market data, interactive charts, and P&L analytics.

![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-via%20better--sqlite3-003B57?logo=sqlite&logoColor=white)

## Features

- **Transaction management** &mdash; Add, edit, and delete BUY/SELL transactions with ticker validation against Yahoo Finance
- **Interactive price charts** &mdash; Line charts with buy/sell markers, cost basis line, and configurable time ranges (1W, 1M, 3M, 6M, 1Y, ALL)
- **Per-position stats** &mdash; Current price, market value, unrealized/realized gain/loss, day change, holding period
- **Portfolio dashboard** &mdash; Total portfolio value, allocation donut chart, sortable position table, top/bottom performers
- **Compare view** &mdash; Overlay 2-4 tickers normalized to % change
- **Filters** &mdash; Search, gain status, position status, sector, date range (combinable with AND logic)
- **Offline support** &mdash; Historical prices cached in SQLite; graceful fallback with stale data indicators
- **Dark theme** &mdash; Bloomberg-inspired palette with IBM Plex Sans and JetBrains Mono fonts

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 35 |
| Frontend | React 19, TypeScript 5.9 |
| Build | Vite 7 via electron-vite 5 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| State | Zustand |
| Database | SQLite via better-sqlite3 |
| Market data | Yahoo Finance via yahoo-finance2 |
| HTTP | Native fetch only (no axios) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone git@github.com:navindasg/stockviewer.git
cd stockviewer
npm install
```

Rebuild native modules for Electron:

```bash
npx electron-rebuild -f -w better-sqlite3
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

## Project Structure

```
electron/          Electron main process + preload
  db/              SQLite database layer
src/               React renderer
  components/      UI components organized by feature
  hooks/           Custom React hooks
  stores/          Zustand stores
  types/           TypeScript interfaces
  utils/           Pure utility functions
```

## Architecture

All network requests (Yahoo Finance) go through the Electron main process via IPC. The renderer never makes direct network calls.

```
Main Process
  ├── SQLite database (better-sqlite3)
  ├── Market data fetching (yahoo-finance2)
  └── IPC handlers

Preload
  └── contextBridge exposing typed ElectronAPI

Renderer
  ├── React UI
  ├── Zustand store
  └── Calls main process via window.electronAPI
```

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Strict CSP in the renderer
- Exact version pinning in package.json (no ^ or ~)
- No axios (see CLAUDE.md for rationale)

## License

MIT
