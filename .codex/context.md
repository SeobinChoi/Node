# Session Context / Handoff — Node app

_Snapshot for resuming work. Source of truth = `.codex/` (do not rely on chat history)._
_Last updated: 2026-07-16._

## What this project is
Next.js 16 (App Router) collaborative **dependency-graph / board** task app: orgs → teams → projects → nodes(tasks) on a React Flow canvas, with RBAC, inbox/requests, Stripe billing, AI generation, and public Korean-gov/military demo pages. Auth = Google OAuth (NextAuth v5, JWT sessions). DB = Postgres via Prisma. Deployed on Vercel (`node-ruddy-tau.vercel.app`); GitHub `SeobinChoi/Node` (branch `main`, commit straight to main per project convention).

## Business direction (why the recent work)
Turning this into a SaaS. **First customer = 서강대 AI중심대학 사업단 (행정부서)** via a professor contact on the 산학협력단/행정 side. Wedge = Korean public/university sector where foreign SaaS can't easily go. Killer angle: the tool = "AI DRIVEN UNIVERSITY / 행정 AX" fit → budget justification is built-in; sell it as a 연차보고·실적 취합·과제 진행 관리 도구. HWP export is a future moat (out of scope now). IP: user is sole primary author; one early contributor (정유연, ~65 commits incl. Stripe billing, Dec 2025) needs a written IP release — message sent.

## Current state (all green)
- **Local dev runs end-to-end.** Login → dashboard → graph all work.
- **10/10 e2e green**, `npm run verify` green (lint zero-warning + smoke + build), tsc 0 errors.

### Fixes landed this session (committed + pushed)
1. `app/login/page.tsx` — `sanitizeRedirect()` guards `callbackUrl` → fixed login 500 crash (`eb61b7d`).
2. Google `invalid_client` — user rotated `GOOGLE_CLIENT_SECRET` in `.env.local`/`.env` (env only, not in repo).
3. Local DB schema drift — ran `prisma db push` (added `teams.is_default`) to local `node_db`.
4. e2e: shared helpers + list-view + grid specs, fixed stale demo smokes (`bf0417e`).
5. Board-style graph canvas — nodes fit board rectangles (`10dd165`).
6. **UI polish Phase 0** (`dcf7510`): brand tokens + `lib/ui/node-visuals.tsx`.
7. **UI polish Phase 1** (`7b4fbf8`): board card — type-color strips, status pills, crisp states.

## ⚠️ Operational gotchas (IMPORTANT)
- **Repo path is now `/Users/xavi/Developer/Node`** (moved 2026-07-17 from `~/Desktop/real_code/web/Node`). Do NOT move it back under `~/Desktop` or `~/Documents` — see below.
- **RESOLVED (2026-07-17): the old "Turbopack hangs" note was WRONG.** The real cause was that the repo lived on the **iCloud-synced Desktop**. macOS had evicted `node_modules` file contents to iCloud (`flags=compressed,dataless`, `blocks_allocated=0`), so the *first* read of each file cost ~1s to download. Measured: 60 cold files = **76,589 ms**; same files re-read = **100 ms**; same files on non-synced disk = **87 ms** (~880x slower). With 47,838 files in `node_modules`, one compile needed ~13h of downloading → indistinguishable from a hang. It also made `git status`, `tsc`, and `prisma db push` "hang".
  - Symptom signature: process idle at ~0% CPU; `sample <pid>` shows the main thread parked in `uv_fs_read` → `read`.
  - Fix applied: moved repo to `~/Developer` (never iCloud-synced), deleted + reinstalled `node_modules`. Now `next dev` is Ready in ~200ms, `/login` 200 in 0.23s, `prisma db push` 1s.
  - **Both Turbopack and webpack work now.** `npm run dev:webpack` is kept as a convenience script, but the `--webpack` workaround is no longer required.
  - Verify with: `find . -type f -flags +dataless | wc -l` (must be 0).
- After a fresh `npm install`, run `prisma generate` — there is no postinstall hook, so the server 500s with `Cannot find module '.prisma/client/default'` until you do.
- `.env.local` DATABASE_URL = local Postgres `node_db` @ localhost:5432. Local Postgres = Homebrew `postgresql@16` (`brew services start postgresql@16`); pg_hba is `trust`, so the password in the URL is ignored locally.
- ⚠️ `.env` (not `.env.local`) holds a **remote Supabase `DIRECT_URL`**; if it leaks into a local run, Prisma will target the remote host.
- The environment has **no GNU `timeout`** (macOS) — wrapping cmds in `timeout` returns 127.
- Local binaries via `node node_modules/<pkg>/…` (e.g. `node node_modules/typescript/bin/tsc`), and `node node_modules/eslint/bin/eslint.js`.

## Testing
- Full e2e (local DB, forged-cookie auth, bypasses Google OAuth):
  `E2E_ENV_FILE=.env.local RUN_DB_E2E=1 npx playwright test`
- Specs in `tests/e2e/`: public-smoke, authenticated-workspace, collaboration-permissions, node-hierarchy, list-view, graph-grid-organize. Shared helpers in `tests/e2e/_helpers.ts` (`seedWorkspace`/`seedNode`/`addAuthCookie`/`apiFor`). `list-view` asserts Korean status labels (완료/진행/막힘/지연) — keep stable. Playwright chromium was installed via `npx playwright install chromium`.
- Screenshot pattern for visual review: temp spec seeding nodes → `page.screenshot("test-results/board.png")` → Read the PNG.

## Three-view architecture (2026-07-17, 전면 개편 landed)
The project page is now **브리핑 | 보드 | 목록** (briefing is the default; `?nodeId=` deep-links land on 보드). All verified: vitest 12/12, tsc 0, eslint 0, e2e 10/10.
- **브리핑 (answer-first)**: `components/graph/ProjectBriefingView.tsx` renders `lib/briefing/derive-briefing.ts` — a pure, RULE-BASED deriver (no LLM) over the existing `GET /api/projects/[id]/graph` payload. Situation headline (D-day + blocked count + root cause), 핵심 병목 (cycle-safe transitive DEPENDS_ON walk to terminal prerequisites), action queue 지연→막힘→대기→지금 with Korean reasons re-derived from structure (`선행 N건 미완료 · {title}`, `승인 대기`, `응답 대기`). Queue rows deep-link via focusNodeId (for dep-blocked rows = the first incomplete prerequisite, not the blocked node itself). Unit tests: `lib/briefing/derive-briefing.test.ts` (vitest, `npm run test:unit`).
- **Edge direction convention (easy to get backwards!)**: `from DEPENDS_ON to` = FROM is the dependent, TO is the prerequisite. A seed script with reversed edges makes DONE nodes compute as BLOCKED.
- Shared date utils extracted to `lib/utils/overdue.ts` (`startOfToday`, `startOfDay`, `getOverdueDays`) — used by ProjectListView + briefing.
- `fallbackReasonKo()` (exported from derive-briefing) translates server English `waitingReason` → Korean; ProjectListView 비고 uses it.
- Both graph pages edited in lockstep (canonical org route + legacy `/projects/[id]/graph`).
- e2e: specs that need the canvas must click 보드 first (default is 브리핑); tab label 그래프 was renamed 보드.

## Token migration (2026-07-17, whole-app light mode)
- **Sidebar is now light + tokenized** (`--sidebar-*` tokens + brand). `FolderTreeItem.tsx` (incl. ProjectTreeItem) migrated with it. No behavior changes — classes only.
- Toolbar/ActionCenterBar/ProjectListView/NodeDetailSheet/DashboardShell/FolderSection/ProjectHeader/login: hardcoded slate/hex → tokens; primary actions = `bg-brand`. Purple AI motif kept. Semantic colors (overdue red, status colors) kept literal.
- Canvas colors centralized in `lib/ui/graph-colors.ts` (React Flow can't take CSS vars). MiniMap: pannable, hidden below xl (overlapped last board column).
- ProjectListView rows now show the type corner-tag (`TYPE_VISUALS.tagClass`).
- Dark mode still deferred (tokens exist; no ThemeProvider mounted).

## Previous: app-wide UI polish (Azure DevOps Boards–crisp)
Plan file: `~/.claude/plans/shimmering-squishing-bumblebee.md`. User decisions: **whole app**, **Azure Boards crisp**, directness = all 4 (한눈에 읽힘 / 원클릭 편집 / 주요 액션 강조 / 군더더기 제거).
- ✅ Phase 0 — `app/globals.css` brand tokens (`--brand` blue-600-ish) + `lib/ui/node-visuals.tsx` (STATUS_VISUALS + TYPE_VISUALS).
- ✅ Phase 1 — `components/graph/CustomNode.tsx` status pill + crisp states. **Revised 2026-07-17 after user review** (decisions below are settled — apply the same language in Phases 2–4):
  - **Corner tag, not a type strip.** The bold `bg-*-500` top strip is gone; the card now shows a tag with `TYPE_VISUALS.icon` + label (TASK/DECISION/INFO/BLOCKER). Rationale: type must not depend on learning a 4-color legend (행정 사용자 기준). Title moved to its own full-width line.
  - **Toned down.** New `TYPE_VISUALS[].tagClass` (`*-50/70` bg, `*-100` border, `*-600` text) — deliberately quieter than `badgeClass`, which list/detail surfaces still use. BLOCKED left accent softened `3px red-500` → `2px red-400`.
  - **Cards centered in their board cell** — see geometry note below.
- ⏳ Phase 2 — Toolbar (`components/graph/Toolbar.tsx`): prominent brand "Add Node", quieter secondary, cleaner glass panel; align ActionCenterBar/save-status.
- ⏳ Phase 3 — `components/graph/ProjectListView.tsx`: add type icons to rows, tighten tiles/table (already consumes STATUS_VISUALS).
- ⏳ Phase 4 — app surfaces: `ProjectCard.tsx`, `FolderSection.tsx`, projects page, `ProjectHeader.tsx`, `DashboardShell.tsx`, `Sidebar.tsx` — adopt brand tokens + crisp spacing.
- Out of scope: dark mode wiring (ThemeProvider not mounted; `next-themes` installed).
- ~~Open check with user on the Phase-1 card direction~~ → **resolved 2026-07-17**: corner tag / centered in cell / toned down. Phases 2–4 should follow that language.

## Graph board geometry (source of truth: `lib/utils/graph-grid.ts`)
- Card = `GRAPH_NODE_WIDTH` 264 × `GRAPH_NODE_HEIGHT` 132 (nominal — real height varies with title wrap, measured 129).
- Cell = `GRAPH_GRID_COLUMN_WIDTH` 300 × `GRAPH_GRID_ROW_HEIGHT` 170. ⚠️ **Not `[320,180]`** — older notes said so and it is wrong; seeds/tests using 320/180 land off-grid.
- Node coords are cell multiples (`k*300`, `j*170`) = the card's **top-left**, so the card is 36×38 smaller than its cell.
- To center the card, the **cell boundary is drawn at `k*300 - 18` / `j*170 - 19`** by `components/graph/BoardCellsBackground.tsx`. Node coords are untouched (no data migration).
- ⚠️ **Why a custom background:** reactflow v11's `<Background variant="lines">` **ignores the `offset` prop** — it always draws lines through the tile center (`M{w/2} 0 V{h}` + `patternTransform: translate(-w/2,-h/2)`). Verified: `offset={-120}` produced a byte-identical path. Do not try to re-solve this with `offset`.
- Verified in-browser: `gapLeft`/`gapRight` = exactly 18/18 at zoom 1.0 and 0.779. Vertical is `gapTop` 19 with the remainder at the bottom (card height is dynamic — exact vertical centering is not achievable with a fixed grid).

## Design system facts (for the polish)
- Tailwind v4 **CSS-first** (no `tailwind.config.*`); theme in `app/globals.css` `@theme inline` + `:root`. shadcn "new-york", neutral base, Geist fonts. `--primary` is black; brand = new `--brand` blue.
- `tw-animate-css` available (no framer-motion). Reference token-clean components: `ProjectCard.tsx`, `ProjectHeader.tsx`. Reuse `cn()`, shadcn `Button`/`Badge`/`Card`.
- Sidebar is a dark hardcoded-hex surface. AI motif = purple + `Sparkles`. Primary action motif = blue (now `--brand`).

## Other open items (deferred)
- Layer-4 interactive UI walkthrough (needs Claude-in-Chrome extension connected — was unreachable).
- Remaining e2e specs: inbox-requests, node-detail-ui, billing-display.
- Codex tasks still open: Google OAuth callback verify in prod; stale-session recovery path; decide demo-route commit scope (mostly resolved).
