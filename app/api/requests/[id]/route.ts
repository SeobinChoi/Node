import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isOrgAdmin } from "@/lib/utils/permissions";

// DELETE /api/requests/[requestId] - Delete a request
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const req = await prisma.request.findUnique({
            where: { id },
            select: { orgId: true, fromUserId: true },
        });

        if (!req) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        // Only the request creator or an org admin may delete it — not any
        // member of the org.
        const canDelete =
            req.fromUserId === user.id || (await isOrgAdmin(req.orgId, user.id));
        if (!canDelete) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.request.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/requests/[requestId] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
