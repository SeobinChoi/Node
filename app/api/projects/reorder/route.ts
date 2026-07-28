import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const ReorderProjectsSchema = z.object({
    orgId: z.string(),
    items: z.array(z.object({
        id: z.string(),
        order: z.number(),
        folderId: z.string().nullable().optional(),
    })),
});

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
}

function getPrismaErrorMetadata(error: unknown) {
    if (typeof error !== "object" || error === null) {
        return {};
    }

    return error as { code?: string; meta?: unknown };
}

// PUT /api/projects/reorder - Bulk update project order and subject assignment
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId, items } = ReorderProjectsSchema.parse(body);

        // Verify membership
        const isMember = await isOrgMember(orgId, user.id);
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Every project being reordered must belong to this org — otherwise a
        // caller could reorder / reparent another tenant's projects by id.
        const itemIds = items.map((item) => item.id);
        if (itemIds.length > 0) {
            const ownedCount = await prisma.project.count({
                where: { id: { in: itemIds }, orgId },
            });
            if (ownedCount !== itemIds.length) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Any destination folder must also belong to this org.
        const targetFolderIds = [
            ...new Set(
                items
                    .map((item) => item.folderId)
                    .filter((folderId): folderId is string => Boolean(folderId))
            ),
        ];
        if (targetFolderIds.length > 0) {
            const ownedFolders = await prisma.folder.count({
                where: { id: { in: targetFolderIds }, orgId },
            });
            if (ownedFolders !== targetFolderIds.length) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Use transaction to update all. updateMany is scoped by orgId as a
        // defense-in-depth backstop even though ownership is verified above.
        await prisma.$transaction(
            items.map((item) =>
                prisma.project.updateMany({
                    where: { id: item.id, orgId },
                    data: {
                        sortOrder: item.order,
                        // Only update folderId if it is explicitly provided (including null)
                        ...(item.folderId !== undefined ? { folderId: item.folderId } : {})
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PUT /api/projects/reorder error:", error);
        const metadata = getPrismaErrorMetadata(error);
        if (metadata.code) console.error("Error code:", metadata.code);
        if (metadata.meta) console.error("Error meta:", metadata.meta);
        return NextResponse.json({ error: "Failed to reorder projects", details: getErrorMessage(error) }, { status: 500 });
    }
}
