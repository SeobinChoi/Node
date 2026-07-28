import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe";
import { isOrgAdmin } from "@/lib/utils/permissions";

export async function POST(req: NextRequest) {
    try {
        if (!stripe) {
            return NextResponse.json(
                { error: "Stripe is not configured" },
                { status: 503 }
            );
        }

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await req.json();
        if (!orgId) {
            return NextResponse.json(
                { error: "Organization ID is required" },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!org) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            );
        }

        // The billing portal can cancel the subscription and change the payment
        // method, so restrict it to the org owner or an active ADMIN member.
        const canManageBilling =
            org.ownerId === session.user.id || (await isOrgAdmin(orgId, session.user.id));
        if (!canManageBilling) {
            return NextResponse.json(
                { error: "Organization admin access required" },
                { status: 403 }
            );
        }

        if (!org.stripeCustomerId) {
            return NextResponse.json(
                { error: "No Stripe customer found. Please upgrade to Pro first." },
                { status: 400 }
            );
        }

        // Validate that the customer exists in Stripe
        try {
            await stripe.customers.retrieve(org.stripeCustomerId);
        } catch (error) {
            console.error(`Customer ${org.stripeCustomerId} not found in Stripe:`, error);
            return NextResponse.json(
                { error: "Stripe customer not found. Please contact support or try upgrading again." },
                { status: 400 }
            );
        }

        // Create billing portal session
        // Dynamically determine base URL from request headers or environment
        const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/");
        const baseUrl = process.env.NEXTAUTH_URL || origin || "http://localhost:3000";

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: org.stripeCustomerId,
            return_url: `${baseUrl}/org/${orgId}/billing`,
        });

        return NextResponse.json({ url: portalSession.url });
    } catch (error) {
        console.error("Portal error:", error);
        return NextResponse.json(
            { error: "Failed to create portal session" },
            { status: 500 }
        );
    }
}
