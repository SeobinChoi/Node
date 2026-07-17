// 데모/검증용 보드 시드: "AI중심대학 사업 2차년도" 프로젝트를 만들고
// 4개 타입 · 전 상태 · 지연 1건 · 의존성 7개를 채운다.
//
// 실행:  dotenv -e .env.local -- node scripts/seed-demo-board.mjs
// (같은 이름의 기존 프로젝트는 지우고 다시 만든다)
//
// ⚠️ 엣지 방향 규약: from이 to에 의존한다 (from DEPENDS_ON to).
//    방향을 뒤집으면 완료(DONE) 노드가 BLOCKED로 계산된다.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// 그리드 셀 = [GRAPH_GRID_COLUMN_WIDTH, GRAPH_GRID_ROW_HEIGHT] (lib/utils/graph-grid.ts)
const CELL_X = 300;
const CELL_Y = 170;
const at = (col, row) => ({ positionX: col * CELL_X, positionY: row * CELL_Y });

const daysFromNow = (d) => new Date(Date.now() + d * 86400000);

async function main() {
  // SEED_ORG_ID / SEED_USER_ID 로 지정하거나, 없으면 첫 조직/소유자를 쓴다.
  let orgId = process.env.SEED_ORG_ID;
  let userId = process.env.SEED_USER_ID;
  if (!orgId || !userId) {
    const org = await prisma.organization.findFirst({ select: { id: true, ownerId: true } });
    if (!org) throw new Error("조직이 없습니다. 먼저 로그인해 워크스페이스를 만드세요.");
    orgId = orgId || org.id;
    userId = userId || org.ownerId;
  }

  await prisma.project.deleteMany({ where: { orgId, name: "AI중심대학 사업 2차년도" } });

  const project = await prisma.project.create({
    data: {
      name: "AI중심대학 사업 2차년도",
      description: "연차보고 · 실적 취합 · 과제 진행 관리",
      orgId,
      ownerId: userId,
      members: { create: { userId, orgId, role: "PROJECT_ADMIN", isFavorite: true } },
    },
  });

  const base = { projectId: project.id, orgId, ownerId: userId };

  const spec = [
    // [key, title, type, manualStatus, col, row, dueInDays]
    ["kickoff",  "2차년도 사업계획 확정",   "DECISION", "DONE",  0, 0, null],
    ["budget",   "예산 집행 내역 정리",     "TASK",     "DONE",  0, 1, null],
    ["collect",  "학과별 실적 자료 취합",   "TASK",     "DOING", 1, 0, 3],
    ["overdue",  "교육과정 개편 결과 제출", "TASK",     "DOING", 1, 1, -2],
    ["approval", "산학협력단 검토 승인",    "DECISION", "TODO",  2, 0, 7],
    ["missing",  "미제출 학과 자료 요청",   "INFOREQ",  "TODO",  2, 1, 5],
    ["blocker",  "전산시스템 연동 지연",    "BLOCKER",  "TODO",  3, 1, null],
    ["report",   "연차보고서 최종 제출",    "TASK",     "TODO",  3, 0, 14],
  ];

  const nodes = {};
  for (const [key, title, type, manualStatus, col, row, due] of spec) {
    nodes[key] = await prisma.node.create({
      data: {
        ...base,
        title,
        type,
        manualStatus,
        ...at(col, row),
        dueAt: due === null ? null : daysFromNow(due),
      },
    });
  }

  // from이 to에 의존한다.
  const edges = [
    ["collect", "kickoff", "DEPENDS_ON"],
    ["collect", "budget", "DEPENDS_ON"],
    ["approval", "collect", "DEPENDS_ON"],
    ["approval", "missing", "NEEDS_INFO_FROM"],
    ["report", "blocker", "DEPENDS_ON"],
    ["report", "approval", "APPROVAL_BY"],
    ["overdue", "report", "HANDOFF_TO"],
  ];

  for (const [from, to, relation] of edges) {
    await prisma.edge.create({
      data: {
        projectId: project.id,
        orgId,
        fromNodeId: nodes[from].id,
        toNodeId: nodes[to].id,
        relation,
      },
    });
  }

  console.log(`PROJECT_URL=/org/${orgId}/projects/${project.id}/graph`);
  console.log(`nodes=${Object.keys(nodes).length} edges=${edges.length}`);
}

main()
  .catch((e) => {
    console.error("SEED_ERROR", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
