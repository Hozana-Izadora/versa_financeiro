# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

```
Financeiro/j
├── backend/          Node.js/Express REST API (port 3001)
└── frontend/         React + Vite + Tailwind SPA (port 5173)
```

The original `dashboard_financeiro.html` is the single-file predecessor kept for reference.

## Development Commands

### Backend
```bash
cd backend
npm install
npm run dev      # node --watch src/index.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # vite dev server with proxy to :3001
npm run build    # production build
```

Both must run simultaneously. The Vite dev server proxies `/api/*` to `http://localhost:3001`.

## Backend Architecture

**Entry:** `backend/src/index.js` — Express server, mounts routers, exposes `POST /api/seed` and `DELETE /api/reset`.

**Store:** `backend/src/store.js` — Single in-memory state object persisted to `backend/data/db.json` on every mutation. All routes read/write through `store.get()` / `store.set()` / `store.setTransactions()`.

**Routes:**
| File | Prefix | Responsibility |
|------|--------|----------------|
| `routes/transactions.js` | `/api/transactions` | CRUD for transactions; handles base switching on regime change |
| `routes/plano.js` | `/api/plano` | CRUD for chart of accounts; `PUT /categoria/:cat` must be declared before `PUT /:tipo` |
| `routes/saldos.js` | `/api/saldos` | GET/PUT opening balances keyed `"YYYY-MM"` or `"YYYY-base"` |
| `routes/upload.js` | `/api/import` | Multer file upload (xlsx/csv), CSV parser, column alias detection, import history |

**Seed data:** `backend/src/seed.js` exports `defaultPlano` (27 items) and `generateSample(plano)` which returns `{ caixa, competencia }` with transactions for the current year up to the current month.

## Frontend Architecture

**State:** Single React context in `src/context/AppContext.jsx` using `useReducer`. Shape:
```js
{
  transactions: { caixa: [], competencia: [] },
  plano: [], planoCores: {},
  saldosIniciais: {},
  importHistory: [],
  currentPage: 'caixa',
  filterState: { year, months: Set, group, availableMonths },
  loading, notification, modal
}
```
`actions.refreshAll()` fetches all four API endpoints in parallel and populates the store.

**Routing:** No router library. `currentPage` string drives a switch in `App.jsx → Router`.

**Pages → API flow:**
- `Caixa` / `Competencia` — read-only; filter `transactions.[caixa|competencia]`, call `buildDRE()`, render charts + `DreTable`
- `Lancamentos` — CRUD via `api.createTransaction`, `updateTransaction`, `deleteTransaction`; opens `TransactionForm` inside modal
- `Plano` — CRUD via `api.createPlanoItem`, `updatePlanoItem`, `deletePlanoItem`, `updateCategoria`, `deleteCategoria`
- `Importar` — file upload via `api.importFile`, sample via `api.seed`, saldos via `api.updateSaldos`

**DRE computation:** `src/utils/dreBuilder.js → buildDRE(tx, plano, visMonths, mode, filterState, saldosIniciais)` returns a `rows` array and per-month aggregates (`mRec`, `mCost`, `mMgB`, etc.). The `rows` array is consumed by `DreTable` which handles expand/collapse locally with `useState`.

**Row types in DRE:** `section | group | subgroup | item | subtotal | total | saldo | saldo-acum | ll` — each maps to a CSS class defined in `src/index.css` (`dr-section`, `dr-group`, etc.).

**CSS approach:** Tailwind for layout/spacing. Complex DRE table row styles (`dr-*`, `cv-pos/neg`) and component styles (`kpi-card`, `btn`, `tag`, `panel`, `upload-zone`, `notif`) are defined as `@layer components` in `src/index.css`. Custom colors are configured in `tailwind.config.js` under `bg`, `card`, `text`, `accent`, and `fin` namespaces.

## Key Conventions

- **Transactions** are stored split by regime: `txBase.caixa` and `txBase.competencia`. A transaction's base is determined by its `regime` field (`"Caixa"` → `caixa`, `"Competência"` → `competencia`).
- **Date format** throughout is `"YYYY-MM-DD"`. Use `new Date(r.data + 'T12:00')` when parsing to avoid timezone off-by-one errors.
- **Modal content** is a JSX element passed to `actions.openModal(jsx)`. The modal wrapper is rendered once in `App.jsx`.
- **Notifications** use `actions.notify(msg, cls)` where `cls` is `'ns'` (success), `'ne'` (error), or `'ni'` (info).
- **Chart.js** registration: `Caixa.jsx` and `Competencia.jsx` each call `ChartJS.register(...)` at module level — do not remove these or charts will silently fail.
