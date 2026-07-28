import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isOrgAdmin } from "@/lib/utils/permissions";

// PATCH /api/requests/[requestId]/archive - Archive a request
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const req = await prisma.request.findUnique({
            where: { id },
            select: { orgId: true, fromUserId: true, toUserId: true },
        });

        if (!req) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        // isArchived is a global flag on the request, so restrict archiving to a
        // participant (creator or assignee) or an org admin.
        const canArchive =
            req.fromUserId === user.id ||
            req.toUserId === user.id ||
            (await isOrgAdmin(req.orgId, user.id));
        if (!canArchive) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { isArchived: true },
        });

        return NextResponse.json({ success: true, request: updated });
    } catch (error) {
        console.error("PATCH /api/requests/[requestId]/archive error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
