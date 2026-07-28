import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { ACTIVE_ORG_MEMBER_STATUSES } from "@/lib/utils/permissions";

/**
 * GET /api/organizations/search?q=...
 * Search the caller's own organizations by name.
 *
 * NOTE: previously this returned EVERY organization in the system matching a
 * 2-char substring (id + name) to any authenticated user — a cross-tenant
 * enumeration leak. Results are now scoped to orgs the caller actively belongs
 * to. Onboarding joins go through invite codes (/invite/[code]), not this route.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();
        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json({ organizations: [] });
        }

        const organizations = await prisma.organization.findMany({
            where: {
                name: {
                    contains: query,
                    mode: "insensitive",
                },
                members: {
                    some: {
                        userId: user.id,
                        status: { in: [...ACTIVE_ORG_MEMBER_STATUSES] },
                    },
                },
            },
            select: {
                id: true,
                name: true,
            },
            take: 10,
        });

        return NextResponse.json({ organizations });
    } catch (error) {
        console.error("GET /api/organizations/search error:", error);
        return NextResponse.json(
            { error: "Failed to search organizations" },
            { status: 500 }
        );
    }
}
