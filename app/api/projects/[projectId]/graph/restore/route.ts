import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectEdit } from "@/lib/utils/permissions";
import { assertWithinNodeLimit } from "@/lib/subscription";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { createActivityLog } from "@/lib/utils/activity-log";
import { EdgeRelation, ManualStatus, NodeType } from "@/types";

const RestoreNodeSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  parentNodeId: z.string().nullable(),
  teamId: z.string().nullable(),
  ownerId: z.string().nullable(),
  teams: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  owners: z.array(z.object({ id: z.string(), name: z.string().nullable() })).default([]),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  type: z.nativeEnum(NodeType),
  manualStatus: z.nativeEnum(ManualStatus),
  priority: z.number().int().min(1).max(5),
  dueAt: z.string().nullable(),
  phase: z.string().nullable(),
  createdAt: z.string(),
  positionX: z.number().nullable(),
  positionY: z.number().nullable(),
});

const RestoreEdgeSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  relation: z.nativeEnum(EdgeRelation),
  createdAt: z.string(),
});

const RestoreGraphSchema = z.object({
  nodes: z.array(RestoreNodeSchema).default([]),
  edges: z.array(RestoreEdgeSchema).default([]),
  childParentRestores: z
    .array(z.object({ nodeId: z.string(), parentNodeId: z.string() }))
    .default([]),
});

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
      select: { orgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { nodes, edges, childParentRestores } = RestoreGraphSchema.parse(body);

    // Enforce the free-tier node limit for the nodes this restore would newly
    // create (restore accepts a browser-supplied node list, so it is a create
    // path too). Nodes that already exist are skipped below, so only count the
    // genuinely-new ones — this avoids over-blocking a legitimate undo.
    const restorablePayloadIds = nodes
      .filter((node) => node.projectId === projectId && node.orgId === project.orgId)
      .map((node) => node.id);
    if (restorablePayloadIds.length > 0) {
      const alreadyPresent = await prisma.node.count({
        where: { id: { in: restorablePayloadIds }, projectId },
      });
      const newNodeCount = restorablePayloadIds.length - alreadyPresent;
      if (newNodeCount > 0) {
        await assertWithinNodeLimit(project.orgId, newNodeCount);
      }
    }

    const nodeIdSet = new Set(nodes.map((node) => node.id));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const restoreDepth = (nodeId: string) => {
      let depth = 0;
      let parentNodeId = nodeById.get(nodeId)?.parentNodeId ?? null;

      while (parentNodeId && nodeById.has(parentNodeId)) {
        depth += 1;
        parentNodeId = nodeById.get(parentNodeId)?.parentNodeId ?? null;
      }

      return depth;
    };
    const orderedNodes = [...nodes].sort((a, b) => restoreDepth(a.id) - restoreDepth(b.id));

    const restoredCount = await prisma.$transaction(async (tx) => {
      let restoredNodes = 0;

      for (const node of orderedNodes) {
        if (node.projectId !== projectId || node.orgId !== project.orgId) continue;

        const existingNode = await tx.node.findUnique({
          where: { id: node.id },
          select: { id: true },
        });
        if (existingNode) continue;

        let parentNodeId = node.parentNodeId;
        if (parentNodeId && !nodeIdSet.has(parentNodeId)) {
          const parent = await tx.node.findUnique({
            where: { id: parentNodeId },
            select: { projectId: true },
          });
          if (!parent || parent.projectId !== projectId) parentNodeId = null;
        }

        await tx.node.create({
          data: {
            id: node.id,
            orgId: project.orgId,
            projectId,
            parentNodeId,
            title: node.title,
            description: node.description,
            type: node.type,
            manualStatus: node.manualStatus,
            ownerId: node.ownerId,
            teamId: node.teamId,
            priority: node.priority,
            dueAt: node.dueAt ? new Date(node.dueAt) : null,
            phase: node.phase,
            positionX: node.positionX,
            positionY: node.positionY,
            createdAt: new Date(node.createdAt),
            nodeTeams: {
              create: node.teams.map((team) => ({ teamId: team.id })),
            },
            nodeOwners: {
              create: node.owners.map((owner) => ({ userId: owner.id })),
            },
          },
        });
        restoredNodes += 1;
      }

      for (const child of childParentRestores) {
        await tx.node.updateMany({
          where: {
            id: child.nodeId,
            projectId,
          },
          data: {
            parentNodeId: child.parentNodeId,
          },
        });
      }

      const currentNodeIds = new Set(
        (
          await tx.node.findMany({
            where: { projectId },
            select: { id: true },
          })
        ).map((node) => node.id)
      );

      await tx.edge.createMany({
        data: edges
          .filter(
            (edge) =>
              edge.projectId === projectId &&
              edge.orgId === project.orgId &&
              currentNodeIds.has(edge.fromNodeId) &&
              currentNodeIds.has(edge.toNodeId)
          )
          .map((edge) => ({
            id: edge.id,
            orgId: project.orgId,
            projectId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            relation: edge.relation,
            createdAt: new Date(edge.createdAt),
          })),
        skipDuplicates: true,
      });

      if (restoredNodes > 0) {
        await tx.organization.update({
          where: { id: project.orgId },
          data: { nodeCount: { increment: restoredNodes } },
        });
      }

      await createActivityLog(
        {
          orgId: project.orgId,
          projectId,
          userId: user.id,
          action: "RESTORE_GRAPH_ITEMS",
          entityType: "PROJECT",
          entityId: projectId,
          details: {
            nodeIds: nodes.map((node) => node.id),
            edgeIds: edges.map((edge) => edge.id),
          },
        },
        tx
      );

      return restoredNodes;
    });

    return NextResponse.json({ success: true, restoredNodes: restoredCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    const authResponse = authOrPermissionErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof Error && error.message.includes("Free tier limit reached")) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", message: error.message, limit: 20 },
        { status: 403 }
      );
    }

    console.error("POST /api/projects/[projectId]/graph/restore error:", error);
    return NextResponse.json({ error: "Failed to restore graph items" }, { status: 500 });
  }
}
