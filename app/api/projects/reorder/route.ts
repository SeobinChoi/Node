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

        // Use transaction to update all
        await prisma.$transaction(
            items.map((item) =>
                prisma.project.update({
                    where: { id: item.id },
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
