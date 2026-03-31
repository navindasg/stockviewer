# Roadmap

Reference: [prd.md](../prd.md)

## Phases & Parallelization

```
Phase 1: Foundation [COMPLETE]
├── Task 1: Project Scaffolding & Electron Shell [DONE]

Phase 2: Data Layer (parallel)
├── Task 2: SQLite Database & Migrations [DONE]
└── Task 3: TypeScript Types & Utility Functions

Phase 3: Services (parallel after Phase 2)
├── Task 4: Market Data Integration (Yahoo Finance)  ← needs Task 2
└── Task 5: State Management (Zustand Store)          ← needs Tasks 2, 3

Phase 4: Core UI (parallel after Phase 3)
├── Task 6: App Layout Shell                          ← needs Tasks 1, 5
├── Task 7: Transaction Forms                         ← needs Tasks 5, 6
└── Task 8: Price Chart with Buy/Sell Markers         ← needs Tasks 4, 5

Phase 5: Views (parallel after Phase 4)
├── Task 9: Position Detail View & Stats              ← needs Tasks 7, 8
├── Task 10: Dashboard View (Portfolio Summary)       ← needs Tasks 5, 6
├── Task 12: Compare View                             ← needs Task 8
└── Task 13: Transactions View                        ← needs Task 7

Phase 6: Enhancements
├── Task 11: Filters                                  ← needs Tasks 5, 10

Phase 7: Final
└── Task 14: Polish, Performance & Edge Cases         ← needs all
```

## Dependency Graph

```
1 ──┬── 2 ──┬── 4 ──┐
    │       │       ├── 8 ──┬── 9
    │       ├── 5 ──┤       ├── 12
    │       │       ├── 6 ──┤
    ├── 3 ──┘       │       ├── 10 ── 11
    │               └── 7 ──┤
    │                       └── 13
    └───────────────────────────────── 14
```

## Parallelization Opportunities

| Window | Tasks that can run simultaneously | Notes |
|--------|----------------------------------|-------|
| After Task 1 | Tasks 2, 3 | Independent data layer work |
| After Tasks 2, 3 | Tasks 4, 5 | Services layer, both need DB |
| After Task 5 | Tasks 6, 7, 8 | 7 depends on 6 completing first; 8 is independent |
| After Tasks 7, 8 | Tasks 9, 10, 12, 13 | All four views can be built in parallel |
| After Task 10 | Task 11 | Filters depend on dashboard |

## Estimated Effort

| Task | Complexity | Estimate |
|------|-----------|----------|
| 1. Scaffolding | Low | S |
| 2. SQLite & Migrations | Medium | M |
| 3. Types & Utils | Low | S |
| 4. Yahoo Finance | Medium | M |
| 5. Zustand Store | Medium | M |
| 6. Layout Shell | Low-Medium | S-M |
| 7. Transaction Forms | High | L |
| 8. Price Chart | High | L |
| 9. Position Detail | Medium | M |
| 10. Dashboard | Medium-High | M-L |
| 11. Filters | Medium | M |
| 12. Compare View | Medium | M |
| 13. Transactions View | Low-Medium | S-M |
| 14. Polish & Edge Cases | Medium | M |

## Critical Path

The longest dependency chain determines the minimum timeline:

**1 → 2 → 5 → 6 → 7 → 9 → 14**

The price chart (Task 8) is on a parallel critical path and is the highest-risk component. Start it as early as possible.
