import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const ReorderFoldersSchema = z.object({
    orgId: z.string(),
    items: z.array(z.object({
        id: z.string(),
        order: z.number(), // Mapped to sortOrder in DB
        parentId: z.string().nullable().optional(), // Support moving between parents
    })),
});

function getErrorDetails(error: unknown) {
    if (error instanceof Error) {
        return { message: error.message };
    }

    return { message: "Unknown error" };
}

function getPrismaErrorMetadata(error: unknown) {
    if (typeof error !== "object" || error === null) {
        return {};
    }

    return error as { code?: string; meta?: unknown };
}

// PUT /api/folders/reorder - Bulk update folder order
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId, items } = ReorderFoldersSchema.parse(body);

        // Verify membership
        const isMember = await isOrgMember(orgId, user.id);
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Use transaction to update all
        await prisma.$transaction(
            items.map((item) =>
                prisma.folder.update({
                    where: { id: item.id },
                    data: {
                        sortOrder: item.order,
                        ...(item.parentId !== undefined ? { parentId: item.parentId } : {})
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PUT /api/folders/reorder error:", error);
        const metadata = getPrismaErrorMetadata(error);
        const details = getErrorDetails(error);
        if (metadata.code) console.error("Error code:", metadata.code);
        if (metadata.meta) console.error("Error meta:", metadata.meta);
        return NextResponse.json({ error: "Failed to reorder folders", details: details.message }, { status: 500 });
    }
}
