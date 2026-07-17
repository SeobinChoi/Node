import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectEdit } from "@/lib/utils/permissions";
import { assertWithinNodeLimit } from "@/lib/subscription";
import {
  GRAPH_GRID_COLUMN_WIDTH,
  GRAPH_GRID_ROW_HEIGHT,
} from "@/lib/utils/graph-grid";
import { z } from "zod";
import { NodeType, ManualStatus } from "@/types";

// 엑셀/CSV 일괄 등록. 담당자는 이름으로 프로젝트 멤버와 매칭한다(못 찾으면 미지정).
const BulkRowSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.nativeEnum(NodeType).default(NodeType.TASK),
  manualStatus: z.nativeEnum(ManualStatus).default(ManualStatus.TODO),
  ownerName: z.string().max(100).optional().nullable(),
  dueAt: z.string().optional().nullable(), // "YYYY-MM-DD" 또는 ISO
  description: z.string().max(2000).optional().nullable(),
});

const BulkSchema = z.object({
  rows: z.array(BulkRowSchema).min(1).max(200),
});

const COLUMNS_PER_ROW = 4;

function parseDueAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[./]/g, "-");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;
    await requireProjectEdit(projectId, user.id);

    const body = await request.json();
    const { rows } = BulkSchema.parse(body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, orgId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await assertWithinNodeLimit(project.orgId);

    // 담당자 이름 → 프로젝트 멤버 매칭 테이블
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true } } },
    });
    const memberByName = new Map(
      members
        .filter((m) => m.user.name)
        .map((m) => [m.user.name!.trim(), m.user.id])
    );

    // 기존 노드 아래에 격자로 배치
    const maxY = await prisma.node.aggregate({
      where: { projectId },
      _max: { positionY: true },
    });
    const startRow =
      maxY._max.positionY === null
        ? 0
        : Math.floor(maxY._max.positionY / GRAPH_GRID_ROW_HEIGHT) + 1;

    const created = await prisma.$transaction(
      rows.map((row, i) =>
        prisma.node.create({
          data: {
            projectId,
            orgId: project.orgId,
            title: row.title.trim(),
            description: row.description?.trim() || null,
            type: row.type,
            manualStatus: row.manualStatus,
            ownerId: row.ownerName ? memberByName.get(row.ownerName.trim()) ?? null : null,
            dueAt: parseDueAt(row.dueAt),
            positionX: (i % COLUMNS_PER_ROW) * GRAPH_GRID_COLUMN_WIDTH,
            positionY: (startRow + Math.floor(i / COLUMNS_PER_ROW)) * GRAPH_GRID_ROW_HEIGHT,
          },
          select: { id: true, title: true, ownerId: true },
        })
      )
    );

    const unmatchedOwners = [
      ...new Set(
        rows
          .filter((r) => r.ownerName && !memberByName.has(r.ownerName.trim()))
          .map((r) => r.ownerName!.trim())
      ),
    ];

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      unmatchedOwners,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "잘못된 형식의 데이터가 있습니다", details: error.issues.slice(0, 5) },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.includes("Not a member")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/projects/[projectId]/nodes/bulk error:", error);
    return NextResponse.json({ error: "일괄 등록에 실패했습니다" }, { status: 500 });
  }
}
