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
- **Use the webpack dev server, NOT Turbopack.** `next dev` (Turbopack, the default) HANGS compiling some API routes → graph/workspace pages stick on "Loading…". Run:
  `node node_modules/dotenv-cli/cli.js -e .env.local -- env AUTH_URL=http://127.0.0.1:3000 NEXTAUTH_URL=http://127.0.0.1:3000 AUTH_TRUST_HOST=true node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3000`
  (Playwright's webServer already uses `--webpack`.)
- `.env.local` DATABASE_URL = local Postgres `node_db` @ localhost:5432 (user xavi). Not remote.
- The environment has **no GNU `timeout`** (macOS) — wrapping cmds in `timeout` returns 127.
- Local binaries via `node node_modules/<pkg>/…` (e.g. `node node_modules/typescript/bin/tsc`), and `node node_modules/eslint/bin/eslint.js`.

## Testing
- Full e2e (local DB, forged-cookie auth, bypasses Google OAuth):
  `E2E_ENV_FILE=.env.local RUN_DB_E2E=1 npx playwright test`
- Specs in `tests/e2e/`: public-smoke, authenticated-workspace, collaboration-permissions, node-hierarchy, list-view, graph-grid-organize. Shared helpers in `tests/e2e/_helpers.ts` (`seedWorkspace`/`seedNode`/`addAuthCookie`/`apiFor`). `list-view` asserts Korean status labels (완료/진행/막힘/지연) — keep stable. Playwright chromium was installed via `npx playwright install chromium`.
- Screenshot pattern for visual review: temp spec seeding nodes → `page.screenshot("test-results/board.png")` → Read the PNG.

## In-progress task: app-wide UI polish (Azure DevOps Boards–crisp)
Plan file: `~/.claude/plans/shimmering-squishing-bumblebee.md`. User decisions: **whole app**, **Azure Boards crisp**, directness = all 4 (한눈에 읽힘 / 원클릭 편집 / 주요 액션 강조 / 군더더기 제거).
- ✅ Phase 0 — `app/globals.css` brand tokens (`--brand` blue-600-ish) + `lib/ui/node-visuals.tsx` (STATUS_VISUALS + TYPE_VISUALS).
- ✅ Phase 1 — `components/graph/CustomNode.tsx` type strip + status pill + crisp states.
- ⏳ Phase 2 — Toolbar (`components/graph/Toolbar.tsx`): prominent brand "Add Node", quieter secondary, cleaner glass panel; align ActionCenterBar/save-status.
- ⏳ Phase 3 — `components/graph/ProjectListView.tsx`: add type icons to rows, tighten tiles/table (already consumes STATUS_VISUALS).
- ⏳ Phase 4 — app surfaces: `ProjectCard.tsx`, `FolderSection.tsx`, projects page, `ProjectHeader.tsx`, `DashboardShell.tsx`, `Sidebar.tsx` — adopt brand tokens + crisp spacing.
- Out of scope: dark mode wiring (ThemeProvider not mounted; `next-themes` installed).
- **Open check with user**: is the Phase-1 card direction right before propagating (type strip vs corner tag, card centered in cell vs top-left, color boldness)?

## Design system facts (for the polish)
- Tailwind v4 **CSS-first** (no `tailwind.config.*`); theme in `app/globals.css` `@theme inline` + `:root`. shadcn "new-york", neutral base, Geist fonts. `--primary` is black; brand = new `--brand` blue.
- `tw-animate-css` available (no framer-motion). Reference token-clean components: `ProjectCard.tsx`, `ProjectHeader.tsx`. Reuse `cn()`, shadcn `Button`/`Badge`/`Card`.
- Sidebar is a dark hardcoded-hex surface. AI motif = purple + `Sparkles`. Primary action motif = blue (now `--brand`).

## Other open items (deferred)
- Layer-4 interactive UI walkthrough (needs Claude-in-Chrome extension connected — was unreachable).
- Remaining e2e specs: inbox-requests, node-detail-ui, billing-display.
- Codex tasks still open: Google OAuth callback verify in prod; stale-session recovery path; decide demo-route commit scope (mostly resolved).
