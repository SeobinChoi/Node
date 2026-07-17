import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectEdit } from "@/lib/utils/permissions";
import { assertWithinNodeLimit } from "@/lib/subscription";
import {
  GRAPH_GRID_COLUMN_WIDTH,
  GRAPH_GRID_ROW_HEIGHT,
} from "@/lib/utils/graph-grid";

// 빈 프로젝트를 "연차보고 준비" 템플릿으로 시작한다.
// 온보딩 전용: 노드가 하나라도 있으면 409.

const DAY_MS = 24 * 60 * 60 * 1000;

// [key, 제목, 타입, col, row, D+일]
const TEMPLATE_NODES = [
  ["plan", "사업계획 확정", "DECISION", 0, 0, 7],
  ["budget", "예산 집행 내역 정리", "TASK", 0, 1, 14],
  ["collect", "실적 자료 취합", "TASK", 1, 0, 21],
  ["request", "미제출 자료 요청", "INFOREQ", 1, 1, 18],
  ["review", "검토 승인", "DECISION", 2, 0, 28],
  ["report", "최종 보고서 제출", "TASK", 3, 0, 35],
] as const;

// from이 to에 의존한다 (from DEPENDS_ON to)
const TEMPLATE_EDGES = [
  ["collect", "plan", "DEPENDS_ON"],
  ["collect", "budget", "DEPENDS_ON"],
  ["review", "collect", "DEPENDS_ON"],
  ["review", "request", "NEEDS_INFO_FROM"],
  ["report", "review", "APPROVAL_BY"],
] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;
    await requireProjectEdit(projectId, user.id);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, orgId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existing = await prisma.node.count({ where: { projectId } });
    if (existing > 0) {
      return NextResponse.json(
        { error: "이미 업무가 있는 프로젝트에는 템플릿을 적용할 수 없습니다" },
        { status: 409 }
      );
    }

    await assertWithinNodeLimit(project.orgId);

    const now = Date.now();
    const created = await prisma.$transaction(async (tx) => {
      const idByKey = new Map<string, string>();
      for (const [key, title, type, col, row, dueDays] of TEMPLATE_NODES) {
        const node = await tx.node.create({
          data: {
            projectId,
            orgId: project.orgId,
            title,
            type,
            manualStatus: "TODO",
            ownerId: user.id,
            dueAt: new Date(now + dueDays * DAY_MS),
            positionX: col * GRAPH_GRID_COLUMN_WIDTH,
            positionY: row * GRAPH_GRID_ROW_HEIGHT,
          },
          select: { id: true },
        });
        idByKey.set(key, node.id);
      }
      for (const [from, to, relation] of TEMPLATE_EDGES) {
        await tx.edge.create({
          data: {
            projectId,
            orgId: project.orgId,
            fromNodeId: idByKey.get(from)!,
            toNodeId: idByKey.get(to)!,
            relation,
          },
        });
      }
      return idByKey.size;
    });

    return NextResponse.json({ ok: true, createdCount: created });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not a member")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/projects/[projectId]/template error:", error);
    return NextResponse.json({ error: "템플릿 적용에 실패했습니다" }, { status: 500 });
  }
}
