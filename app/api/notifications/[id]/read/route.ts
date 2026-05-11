import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserTeams, requireAuth } from "@/lib/utils/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            return NextResponse.json({ error: "Notification not found" }, { status: 404 });
        }

        const membership = await prisma.orgMember.findUnique({
            where: { orgId_userId: { orgId: notification.orgId, userId: user.id } },
            select: { status: true },
        });

        if (!membership || !["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(membership.status)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const teamIds = await getUserTeams(notification.orgId, user.id);

        const result = await prisma.notification.updateMany({
            where: {
                id,
                orgId: notification.orgId,
                isRead: false,
                OR: [
                    { userId: user.id },
                    {
                        targetType: "TEAM",
                        targetTeamId: { in: teamIds },
                    },
                ],
            },
            data: { isRead: true },
        });

        if (result.count === 0) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/notifications/[id]/read error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
