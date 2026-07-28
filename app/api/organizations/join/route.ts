import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { assignToDefaultTeam } from "@/lib/utils/teams";
import { z } from "zod";

const joinOrgSchema = z.object({
    inviteCode: z.string().min(1, "Invite code is required"),
});

/**
 * POST /api/organizations/join
 * Join an organization via a valid invite code.
 *
 * NOTE: joining by raw orgId was removed. It let any authenticated user insert
 * a membership row into ANY organization (spamming admin inboxes and serving as
 * the pivot for the billing-portal takeover chain). Membership now requires
 * possession of the org's invite code, matching the /invite/[code] onboarding.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { inviteCode } = joinOrgSchema.parse(body);

        const org = await prisma.organization.findUnique({
            where: { inviteCode },
            select: { id: true },
        });
        if (!org) {
            return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
        }

        const orgId = org.id;

        // Check if user already has a membership in this org
        const existingMembership = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: user.id,
                },
            },
        });

        if (existingMembership) {
            return NextResponse.json(
                { error: "You already have a membership or pending request in this organization" },
                { status: 400 }
            );
        }

        const orgMember = await prisma.orgMember.create({
            data: {
                orgId,
                userId: user.id,
                role: "MEMBER",
                status: "ACTIVE",
            },
        });

        await assignToDefaultTeam(orgId, user.id);

        return NextResponse.json({
            message: "Joined organization successfully",
            membershipId: orgMember.id,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid request data", details: error.flatten() },
                { status: 400 }
            );
        }

        console.error("POST /api/organizations/join error:", error);
        return NextResponse.json(
            { error: "Failed to submit join request" },
            { status: 500 }
        );
    }
}
