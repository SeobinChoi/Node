---
name: verify
description: Verify Node-app changes end-to-end — unit tests, typecheck, lint, dev server, seeded-board browser check, and Playwright e2e. Use before committing nontrivial changes or when asked to confirm the app works.
---

# Verify the Node workspace app

Run gates in this order (stop and fix at the first failure). If `node`/`npm` are not on PATH, download a standalone Node v22 arm64 tarball from nodejs.org into the session scratchpad and prepend its `bin` — never install system-wide. Always also prepend `node_modules/.bin`.

## 1. Fast gates
```bash
npm run test:unit                          # vitest — briefing deriver etc.
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .   # zero-warning policy
```
If `tsc`/`next` mysteriously hang at ~0% CPU: check `find . -type f -flags +dataless | wc -l` — nonzero means the repo landed in an iCloud-synced folder again (see CLAUDE.md).

## 2. Dev server + browser check (only if the change is previewable)
- Start via the Browser pane's preview (launch config `node-dev` → `npm run dev:webpack`, port 3000). Never Bash-run the server if the preview tool is available.
- If the server 500s with `Cannot find module '.prisma/client/default'`: run `npx prisma generate`.
- Ensure demo data exists: `dotenv -e .env.local -- node scripts/seed-demo-board.mjs` (prints the PROJECT_URL to open).
- Log in with the dev login (email only — `ENABLE_DEV_LOGIN` is set in `.env.local`).
- Open the printed project URL and check all three tabs:
  - **브리핑** (default): headline mentions the overdue task + root cause; queue ordered 지연→막힘→대기→지금; clicking a 막힘 row's button lands on 보드 focused on the *prerequisite*.
  - **보드**: cards centered in grid cells, corner type-tags, status pills.
  - **목록**: rollup counts match (8 nodes: 2 완료 / 2 진행 / 2 막힘 / 1 지연), overdue date red.
- Screenshot as proof.

## 3. Full e2e
```bash
E2E_ENV_FILE=.env.local RUN_DB_E2E=1 npx playwright test
```
- Requires local Postgres (`brew services start postgresql@16`) and Playwright chromium (`npx playwright install chromium` after a fresh npm install).
- Known flake: the `public-smoke` military-demo spec can fail on a cold compile (clicks before hydration). Re-run that spec once before treating it as a real failure.
- Specs needing the canvas must click the 보드 tab first — the default view is 브리핑.
