import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getUserTeams, requireAuth } from "@/lib/utils/auth";

const MarkNotificationsReadSchema = z.object({
  orgId: z.string(),
  notificationIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { orgId, notificationIds } = MarkNotificationsReadSchema.parse(body);

    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: user.id } },
      select: { status: true },
    });

    if (!membership || !["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(membership.status)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const teamIds = await getUserTeams(orgId, user.id);

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        orgId,
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

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    console.error("POST /api/notifications/read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
