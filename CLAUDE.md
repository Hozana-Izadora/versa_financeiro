# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

```
Financeiro/
├── backend/          Node.js/Express REST API (port 3001) + PostgreSQL, multi-tenant
├── frontend/         React + Vite + Tailwind SPA (port 5173)
├── specs/            FUNCIONALIDADES.md (current-behavior reference) + improvement specs
└── examples/         Raw sample spreadsheets/HTML kept for reference — not source code
```

For a detailed, code-accurate description of every screen and formula, read
**`specs/FUNCIONALIDADES.md`** before making changes to DRE/Orçamento/Saldos logic —
it's kept in sync with the code and is more complete than this file. Other files in
`specs/` are improvement proposals (not yet implemented, or partially implemented) —
check whether one already covers the task before writing a new one.

The original `dashboard_financeiro.html` (in `examples/`) is the single-file predecessor kept for reference.

## Development Commands

### Backend
```bash
cd backend
npm install
npm run migrate   # applies backend/migrations/*.sql in order (see README for first-time setup)
npm run dev        # node --watch src/index.js
```
Requires a running PostgreSQL instance and `backend/.env` (copy from `.env.example`) — see `README.md` for full first-time setup (roles, tenant provisioning, JWT secret).

### Frontend
```bash
cd frontend
npm install
npm run dev      # vite dev server with proxy to :3001
npm run build    # production build — verify with ./node_modules/.bin/vite build --mode development, NOT npx vite build (can resolve to a wrong global vite)
```

Both must run simultaneously. The Vite dev server proxies `/api/*` to `http://localhost:3001`.

## Backend Architecture

**Entry:** `backend/src/index.js` — Express server. `/api/auth/*` is public; every other `/api/*` route runs behind `authMiddleware` (JWT). Also exposes `POST /api/seed` and `DELETE /api/reset` (both authenticated, act on the caller's tenant).

**Multi-tenant:** each client has an isolated PostgreSQL schema `tenant_<slug>`, created by `admin.provision_tenant()`. `authMiddleware` (`middleware/auth.js`) verifies the JWT and sets `req.tenantSchema` from the token's `clientId` claim — no route ever trusts a tenant identifier coming from the request body/headers. A central `admin` schema (outside any tenant) holds `clients`, `users`, `client_users`, `roles`, `role_permissions`, `user_roles`, `refresh_tokens`. Every `store/*.js` function takes `tenantSchema` as its first argument and queries through `withTenant()` (`db/tenantContext.js`), which sets `search_path` for that connection.

**Auth & permissions:**
- `routes/auth.js` — login (issues a short-lived JWT access token + httpOnly refresh cookie).
- `middleware/permission.js` → `requirePermission(module, 'read'|'write')` — backend-side module gate (`lancamentos | plano | saldos | importar`). A user with **no roles assigned** gets full access (owner behavior).
- Frontend has a second, finer-grained layer (`usePermissions()`, per screen/chart/subtab) driven by `user.permissions` from the login response — configured together with backend roles in Admin → Permissões.

**Routes:**
| File | Prefix | Responsibility |
|------|--------|----------------|
| `routes/auth.js` | `/api/auth` | Login, refresh, logout, self-service password change (any authenticated user) |
| `routes/transactions.js` | `/api/transactions` | CRUD for transactions; handles base switching on regime change |
| `routes/plano.js` | `/api/plano` | CRUD for chart of accounts; `PUT /categoria/:cat` must be declared before `PUT /:tipo` |
| `routes/saldos.js` | `/api/saldos` | CRUD for opening balances/monthly adjustments (keyed `"YYYY-MM"` or `"YYYY-abertura"`), with audit log |
| `routes/upload.js` | `/api/import` | Multer file upload (xlsx/csv), preview/confirm flow, column alias detection, plano auto-classification, import history |
| `routes/orcamento.js` | `/api/orcamento` | Bulk upsert (`PUT`) + delete of budget entries (`{ano, mes, tipo, referencia, valor}`) |
| `routes/admin.js` | `/api/admin` | Superadmin-only: clients, users, client-user associations (soft-delete via `active` flag) |
| `routes/roles.js` | mounted under `admin.js` | Roles + `role_permissions` CRUD |
| `routes/preferences.js` | `/api/preferences` | Per-user UI preferences (e.g. visible columns in Lançamentos) |

**Seed data:** `backend/src/seed.js` exports `defaultPlano` (27 items) and `generateSample(plano)` which returns `{ caixa, competencia }` with transactions for the current year up to the current month.

**Legacy:** `backend/src/store.js` and `backend/data/db.json` are the pre-multi-tenant, single-file JSON store — no longer used by any route (kept only for the historical `import-db` migration script). Don't extend it; new persistence goes through `store/*.js` + `withTenant()`.

## Frontend Architecture

**State:** Single React context in `src/context/AppContext.jsx` using `useReducer`. Shape (abridged):
```js
{
  transactions: { caixa: [], competencia: [] },
  plano: [], planoCores: {},
  saldosIniciais: {},
  importHistory: [],
  orcamento: [],
  currentPage: 'caixa',
  pendingLancamentosFilter: null,  // drill-down filter to apply once Lançamentos mounts
  pendingSubTab: null,             // sub-tab to select once the target page mounts
  filterState: { year, months: Set, costCenter, costCenterField, availableMonths, compareYear },
  darkMode, loading, notification, modal
}
```
`actions.refreshAll()` fetches transactions/plano/saldos/history/orcamento/preferences in parallel and populates the store. Auth/session state lives separately in `src/context/AuthContext.jsx`.

**Routing:** No router library. `App.jsx`'s `AuthGate` shows `Login` when logged out, a standalone `Admin` for a superadmin with no client context, or `AppProvider` + `Router` otherwise. Inside `Router`, `state.currentPage` string drives a switch (`caixa | competencia | orcamento | lancamentos | plano | importar | admin`), gated per-page by `usePermissions().can(page)`.

**Pages → API flow:**
- `Caixa` / `Competencia` — read-only; filter `transactions.[caixa|competencia]`, call `buildDRE()`, render charts + `DreTable`. Each chart panel supports "ampliar" (fullscreen modal, reusing the same render function) and "minimizar" (collapse body, local state only).
- `Lancamentos` — CRUD via `api.createTransaction`, `updateTransaction`, `deleteTransaction`; opens `TransactionForm` inside modal; consumes `state.pendingLancamentosFilter` on mount (drill-down arrival from a demonstrativo double-click) and shows a "Voltar ao demonstrativo" button while that context is active.
- `Plano` — CRUD via `api.createPlanoItem`, `updatePlanoItem`, `deletePlanoItem`, `updateCategoria`, `deleteCategoria`.
- `Orcamento` — `Acompanhamento` tab is read-only comparison; `Metas` tab (`components/orcamento/MetasTab.jsx`) is the only place that writes to `orcamento`, via `api.upsertOrcamento`/`api.getOrcamento`/`api.deleteOrcamentoEntry`. Only leaf nodes of the gastos tree (`buildDrillTree`) are ever editable — non-leaf totals are always a recursive sum, never a stored value.
- `Importar` — file upload via `api.importFile` (preview → confirm), sample via `api.seed`, saldos CRUD via `api.upsertSaldoEntry`/`api.deleteSaldoEntry`/`api.getSaldosEntries`/`api.getSaldosLog`.
- `Admin` — superadmin-only; Empresas/Usuários tabs soft-delete (`active=false`) instead of hard-deleting; Permissões tab manages roles.

**DRE computation:** `src/utils/dreBuilder.js → buildDRE(tx, plano, visMonths, mode, filterState, saldosIniciais, allTx)` returns a `rows` array and per-month aggregates (`mRec`, `mCost`, `mMgB`, `mAcum`, etc.). `allTx` (unfiltered by month, only Caixa mode needs it) is required for the accumulated-balance rows to correctly carry a prior year's ending balance and to account for months outside the active period filter — passing the already-filtered `tx` there silently drops real movement from skipped months. The `rows` array is consumed by `DreTable`, which handles expand/collapse and column period-aggregation (Mensal/Bimestral/.../Total) locally with `useState`.

**Row types in DRE:** `section | group | subgroup | item | subtotal | total | saldo | ajuste | saldo-acum | ll` — each maps to a CSS class in `src/index.css` (`dr-section`, `dr-group`, etc.). `saldo`/`ajuste`/`saldo-acum` only exist for `mode: 'caixa'`; `ll` only for `mode: 'competencia'`. Cell color always follows the cell's own sign (rounded to cents; zero is neutral gray) — never hardcode a row-level color that ignores the actual value, that's a recurring bug class here.

**CSS approach:** Tailwind for layout/spacing. Complex DRE table row styles (`dr-*`, `cv-pos/neg/neu`) and component styles (`kpi-card`, `btn`, `tag`, `panel`, `upload-zone`, `notif`) are defined as `@layer components` in `src/index.css`. Custom colors are configured in `tailwind.config.js` under `bg`, `card`, `text`, `accent`, and `fin` namespaces.

**Charts:** [Recharts](https://recharts.org/), not Chart.js — no registration step needed; just import the components used (`BarChart`, `LineChart`, etc.) from `'recharts'` in each page file.

## Key Conventions

- **Transactions** are stored split by regime: `txBase.caixa` and `txBase.competencia`. A transaction's base is determined by its `regime` field (`"Caixa"` → `caixa`, `"Competência"` → `competencia`).
- **Date format** throughout is `"YYYY-MM-DD"`. Use `new Date(r.data + 'T12:00')` when parsing to avoid timezone off-by-one errors.
- **Modal content** is a JSX element passed to `actions.openModal(jsx)`. The modal wrapper is rendered once in `App.jsx`.
- **Notifications** use `actions.notify(msg, cls)` where `cls` is `'ns'` (success), `'ne'` (error), or `'ni'` (info).
- **Confirmations/alerts** go through `src/utils/alerts.js` (`confirmDialog`, `alertError`, `alertSuccess`, SweetAlert2-based) — never use the browser's native `confirm()`/`alert()`, they don't match the app's theme and were fully replaced app-wide.
- **Every tenant-scoped backend function takes `tenantSchema` first.** When adding a new `store/*.js` function or route, follow the existing pattern (`withTenant(tenantSchema, async (client) => ...)`) — don't query `pool` directly for tenant data.
