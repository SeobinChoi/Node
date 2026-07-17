---
name: seed-board
description: Seed the local DB with the demo board (AI중심대학 사업 2차년도 — 8 nodes, all types/statuses, 1 overdue, 7 dependency edges). Use when a session needs realistic board data for UI review, screenshots, or manual testing.
---

# Seed the demo board

```bash
dotenv -e .env.local -- node scripts/seed-demo-board.mjs
```
(Prepend the scratchpad Node + `node_modules/.bin` to PATH if `node`/`dotenv` are missing.)

- Idempotent: deletes and recreates the project named "AI중심대학 사업 2차년도".
- Prints `PROJECT_URL=/org/<orgId>/projects/<projectId>/graph` — open that (log in via dev login first).
- Uses the first organization/owner in the DB; override with `SEED_ORG_ID` / `SEED_USER_ID` env vars.
- Requires local Postgres running (`brew services start postgresql@16`) and a user/org to exist (log in once via `/login` dev login if the DB is empty).

Expected resulting state (useful for assertions): 완료 2 · 진행 2 · 막힘 2 · 대기 1 (approval) · 지연 1 (교육과정 개편 결과 제출, D+2). Root causes on the briefing view: 학과별 실적 자료 취합, 전산시스템 연동 지연.

⚠️ If editing the script: edge direction is `from DEPENDS_ON to` = from is the **dependent**, to is the **prerequisite**. Reversing this makes DONE nodes compute as BLOCKED.
