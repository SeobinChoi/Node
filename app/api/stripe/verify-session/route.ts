import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe";
import { isOrgAdmin } from "@/lib/utils/permissions";

type SubscriptionWithPeriod = Awaited<ReturnType<NonNullable<typeof stripe>["subscriptions"]["retrieve"]>> & {
    current_period_end?: number | null;
};

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
            console.error("[verify-session] Unauthorized - no session");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();

        const { sessionId, orgId } = body;
        if (!sessionId || !orgId) {
            return NextResponse.json(
                { error: "Session ID and Org ID are required" },
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

        // Only the org owner or an active ADMIN member may confirm billing.
        const canManageBilling =
            org.ownerId === session.user.id || (await isOrgAdmin(orgId, session.user.id));
        if (!canManageBilling) {
            return NextResponse.json(
                { error: "Organization admin access required" },
                { status: 403 }
            );
        }

        // Retrieve the checkout session from Stripe
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

        // Bind the session to this org: the checkout route stamps metadata.orgId,
        // so a session created for a different org (or replayed) must be rejected.
        // Without this, any admin could mark their org Pro using another org's
        // paid session id.
        if (checkoutSession.metadata?.orgId !== orgId) {
            return NextResponse.json(
                { error: "Checkout session does not belong to this organization" },
                { status: 403 }
            );
        }

        if (checkoutSession.payment_status !== "paid") {
            return NextResponse.json(
                { error: "Payment not completed" },
                { status: 400 }
            );
        }

        // Get subscription details
        const subscriptionId = checkoutSession.subscription as string;
        if (!subscriptionId) {
            return NextResponse.json(
                { error: "No subscription found in session" },
                { status: 400 }
            );
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as SubscriptionWithPeriod;

        // Update organization with subscription details
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                stripeCustomerId: checkoutSession.customer as string,
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items?.data?.[0]?.price?.id,
                stripeSubscriptionStatus: subscription.status,
                stripeCurrentPeriodEnd: subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000)
                    : null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[verify-session] ❌ Error:", error);
        return NextResponse.json(
            { error: "Failed to verify session" },
            { status: 500 }
        );
    }
}
