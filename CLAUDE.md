# CLAUDE.md — Node Workspace App

Last regenerated: 2026-07-17 (previous version described the January state and contained stale paths/constants — trust this one).

## What this is
Next.js collaborative **dependency-graph / board task app**: orgs → teams → projects → nodes(tasks) on a React Flow canvas, with RBAC, inbox/requests, Stripe billing, AI generation, and public Korean-gov demo pages. Target customer: 서강대 AI중심대학 사업단 (행정) — Korean public/university sector. Sell as 연차보고·실적 취합·과제 진행 관리 도구 ("행정 AX").

## Repo location — DO NOT MOVE
Canonical path: `/Users/xavi/Developer/Node`. GitHub `SeobinChoi/Node`, branch `main` (commit straight to main).
⚠️ **Never move this repo under `~/Desktop` or `~/Documents`** — those are iCloud-synced; macOS evicts `node_modules` contents (`dataless` files, ~1s per first read → compiles look like infinite hangs). This burned a full day on 2026-07-17. Symptom signature: any tool (git/tsc/next/prisma) idle at ~0% CPU, `sample <pid>` parked in `uv_fs_read`. Check with `find . -type f -flags +dataless | wc -l` (must be 0).

## Stack
- **Next.js 16.2.9** (App Router) · TypeScript strict · React Query v5 · NextAuth v5 · Prisma 7 (**driver adapter**: `@prisma/adapter-pg` + `pg.Pool` — `new PrismaClient()` without adapter throws; see `lib/db/prisma.ts`)
- **reactflow v11** (`reactflow` package, NOT `@xyflow/react`)
- **Tailwind v4 CSS-first** (no `tailwind.config.*`; theme lives in `app/globals.css` `@theme inline` + `:root`) · shadcn "new-york"
- Tests: **vitest** (`npm run test:unit`, config `vitest.config.ts`, tests in `lib/**/*.test.ts`) + **Playwright** e2e (`tests/e2e/`)

## Commands
```bash
npm run dev:webpack     # THE dev server command (env + --webpack + 127.0.0.1:3000 baked in)
npm run test:unit       # vitest (briefing deriver etc.)
E2E_ENV_FILE=.env.local RUN_DB_E2E=1 npx playwright test   # full e2e (forged-cookie auth, local DB)
npm run verify          # lint (zero-warning) + smoke + build
dotenv -e .env.local -- prisma migrate dev   # schema changes go through MIGRATIONS now
```
⚠️ **Schema changes use `prisma migrate dev` (local) / `migrate deploy` (runs in `npm run build`) since 2026-07-18.** Do not use `db push` against any shared/prod DB — it bypasses migration history. Baseline: `prisma/migrations/*_init`.
- After a fresh `npm install`, run `npx prisma generate` — no postinstall hook; server 500s with `Cannot find module '.prisma/client/default'` until you do.
- Historical note: "Turbopack hangs" in old notes was a misdiagnosis of the iCloud issue above. Both Turbopack and webpack work; `dev:webpack` remains the convenient default.

## Database / env
- Local: Homebrew `postgresql@16` (`brew services start postgresql@16`), DB `node_db`, pg_hba = `trust` (password in URL ignored locally).
- `.env.local` = local Postgres. ⚠️ `.env` contains a **remote Supabase `DIRECT_URL`** — if it leaks into a local run, Prisma targets the remote host.
- Production: Vercel (`node-ruddy-tau.vercel.app`) + Supabase.

## Auth
- Google OAuth (NextAuth v5, JWT sessions) + **dev-only email login**: `Credentials` provider id `dev-login` in `auth.ts`, double-gated by `NODE_ENV !== "production"` AND `ENABLE_DEV_LOGIN === "true"` (set in `.env.local`). Upserts the user by email — works on an empty DB. UI section on `/login`.
- e2e bypasses Google entirely via forged session cookies (`tests/e2e/_helpers.ts`).

## Project page = three switchable views (2026-07 redesign)
`app/(dashboard)/org/[orgId]/projects/[projectId]/graph/page.tsx` renders tabs **브리핑 | 보드 | 목록**:
- Default view is **브리핑**; a `?nodeId=` deep-link lands on 보드 instead.
- ⚠️ A near-duplicate legacy page exists at `app/(dashboard)/projects/[projectId]/graph/page.tsx` — **edit both in lockstep**.

### 브리핑 (answer-first briefing)
- `components/graph/ProjectBriefingView.tsx` renders `lib/briefing/derive-briefing.ts` — a **pure, rule-based deriver** (no LLM) over the graph API payload. Situation headline (D-day, blocked count, root cause), 핵심 병목 (cycle-safe transitive walk up DEPENDS_ON edges to terminal prerequisites), action queue ordered 지연→막힘→대기→지금 with Korean reasons (`선행 N건 미완료 · {선행 제목}`, `승인 대기`, `응답 대기`).
- Queue rows deep-link via `focusNodeId` — for dependency-blocked rows this is the **first incomplete prerequisite** (the thing you can act on), not the blocked node.
- Unit-tested in `lib/briefing/derive-briefing.test.ts`. Keep the deriver pure (takes `nowMs` explicitly).
- `fallbackReasonKo()` (same module) translates server English `waitingReason` → Korean; ProjectListView 비고 uses it.

### 보드 (board canvas)
- `components/graph/GraphCanvas.tsx` + `CustomNode.tsx`. Card language (user-approved, settled): **corner tag** (type icon + label via `TYPE_VISUALS[].tagClass`), toned-down tints, status pill, BLOCKED = `2px red-400` left border.
- **Geometry** (source of truth `lib/utils/graph-grid.ts`): card 264×132, cell **300×170** (old notes saying `[320,180]` are wrong). Node coords are cell multiples = card top-left.
- Cards are centered in cells by `components/graph/BoardCellsBackground.tsx`, which draws the grid pattern itself with boundaries at `k*300−18 / j*170−19`. ⚠️ reactflow v11 `<Background variant="lines">` **ignores its `offset` prop** (always draws through tile centers) — do not try to re-solve centering with it.
- Canvas literals (edge stroke, minimap, grid) centralized in `lib/ui/graph-colors.ts` (React Flow props can't take CSS vars). MiniMap is pannable and hidden below `xl`.

### 목록 (dense list)
- `components/graph/ProjectListView.tsx`: progress rollup + per-parent tables with type tags, Korean status labels, overdue red. Shares `lib/utils/overdue.ts` (`startOfToday`/`startOfDay`/`getOverdueDays`) with the briefing.

## Status & dependency semantics (critical)
- **Edge direction: `from DEPENDS_ON to` = FROM is the dependent, TO is the prerequisite.** Reversed seed edges make DONE nodes compute as BLOCKED — this exact mistake happened; double-check any seeding.
- Server status engine: `lib/status/compute-status.ts#computeAllNodeStatuses`. Priority BLOCKED > WAITING > manualStatus. Only `DEPENDS_ON` and `APPROVAL_BY` affect status; `HANDOFF_TO`/`NEEDS_INFO_FROM` don't (WAITING-for-info comes from linked Request rows).
- `GET /api/projects/[projectId]/graph` returns `{nodes: NodeDTO[], edges: EdgeDTO[]}`; NodeDTO already carries `computedStatus`, `blocksCount`, `waitingReason` (English), `dueAt`, `ownerName`. Derive client-side from this rather than adding endpoints.

## Design system
- Brand tokens in `app/globals.css`: `--brand` (blue-600-ish), `--brand-foreground`, `--brand-muted` — light + dark values exist. **Dark mode is NOT wired** (no ThemeProvider mounted; deliberate deferral — don't "fix" casually).
- `lib/ui/node-visuals.tsx` = single source of truth for status/type visuals: `STATUS_VISUALS` (완료/진행/막힘/대기/예정 + icons + badge classes) and `TYPE_VISUALS` (incl. quiet `tagClass` for corner tags). Never inline-duplicate these maps.
- Sidebar (`components/layout/Sidebar.tsx` + `FolderTreeItem.tsx`) is **light and tokenized** via `--sidebar-*` tokens; primary actions app-wide use `bg-brand`. Purple + `Sparkles` = AI motif. Semantic colors (overdue red, status colors) stay literal.
- Clean reference component for token usage: `components/workspace/ProjectCard.tsx`.
- Still hardcoded (known debt, deferred): `app/(dashboard)/org/[orgId]/settings/page.tsx` (~56 hex), public demo pages (deliberately styled flat for public-sector buyers — do not restyle).

## Workspace data (sidebar/projects pages)
- Canonical query key **`["workspace-structure", orgId]`** via `hooks/use-workspace-structure.ts` (`GET /api/orgs/[orgId]/workspace-structure`). Invalidate it after any create/move/delete of projects/folders. Do not add parallel endpoints or query keys for the same data.
- Graph page uses `["graph", projectId]`.

## Testing rules
- e2e specs that need the canvas must **click the 보드 tab first** (default view is 브리핑). Tab label is 보드, not 그래프.
- `list-view` spec asserts Korean labels (완료/진행/막힘/지연) — keep them stable.
- Playwright config reuses an existing server on :3000 (`reuseExistingServer: true`).
- Known flake: `public-smoke` military-demo spec can click before hydration on a cold compile (zero network requests fired). Passes warm.
- Demo-board seeding: `node scripts/seed-demo-board.mjs` (via dotenv, see script header) — uses correct edge directions.

## Common mistakes to avoid
1. Editing only one of the two duplicate graph pages.
2. Reversing DEPENDS_ON edge direction in seeds/tests.
3. Re-deriving status client-side instead of using `computedStatus`/`blocksCount` from the DTO.
4. Adding new fetch endpoints/query keys for data `workspace-structure` or `/graph` already provides.
5. Inlining status/type colors instead of `node-visuals.tsx`.
6. Trusting old notes: `[320,180]` grid, "Turbopack hangs", `~/Desktop/real_code/...` paths are all obsolete.
