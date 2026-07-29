import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db/prisma";
import Stripe from "stripe";

type SubscriptionWithPeriod = Stripe.Subscription & {
    current_period_end?: number | null;
};

type InvoiceWithSubscription = Stripe.Invoice & {
    subscription?: string | null;
};

/**
 * Webhook delivery is at-least-once and NOT order-guaranteed: Stripe may retry
 * an event, and a `customer.subscription.updated` can arrive after the
 * `customer.subscription.deleted` for the same subscription. Trusting the event
 * payload therefore let a canceled org be silently restored to Pro.
 *
 * Instead of trusting the payload, every handler re-fetches the CURRENT
 * subscription from Stripe and writes that. This makes the handlers convergent:
 * replaying an old event writes today's truth, so they are naturally idempotent
 * and order-insensitive without needing an event-dedupe table.
 */
async function applyCurrentSubscriptionState(subscriptionId: string) {
    if (!stripe) throw new Error("Stripe is not configured");

    const subscription = (await stripe.subscriptions.retrieve(
        subscriptionId
    )) as SubscriptionWithPeriod;

    const customerId = subscription.customer as string;

    const org = await prisma.organization.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true },
    });

    if (!org) {
        // Anomaly: we are billing a customer we cannot map back to an org.
        // Signal failure so Stripe retries and the failure stays visible in the
        // Stripe dashboard, rather than silently dropping a paid subscription.
        throw new Error(`No organization found for Stripe customer ${customerId}`);
    }

    await prisma.organization.update({
        where: { id: org.id },
        data: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items?.data?.[0]?.price?.id,
            stripeSubscriptionStatus: subscription.status,
            stripeCurrentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
        },
    });

    return { orgId: org.id, status: subscription.status };
}

export async function POST(req: NextRequest) {
    if (!stripe) {
        return NextResponse.json(
            { error: "Stripe is not configured" },
            { status: 503 }
        );
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "No signature found" },
            { status: 400 }
        );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not configured");
        return NextResponse.json(
            { error: "Webhook secret not configured" },
            { status: 500 }
        );
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const orgId = session.metadata?.orgId;
                const subscriptionId = session.subscription as string | null;

                // Both of these are stamped by our own checkout route, so a
                // missing value means a paid checkout we cannot attribute.
                // Fail loudly (retry) instead of returning 200 and losing it.
                if (!orgId) {
                    throw new Error(
                        `checkout.session.completed ${session.id} has no orgId metadata`
                    );
                }
                if (!subscriptionId) {
                    throw new Error(
                        `checkout.session.completed ${session.id} has no subscription`
                    );
                }

                const subscription = (await stripe.subscriptions.retrieve(
                    subscriptionId
                )) as SubscriptionWithPeriod;

                await prisma.organization.update({
                    where: { id: orgId },
                    data: {
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: subscription.id,
                        stripePriceId: subscription.items?.data?.[0]?.price?.id,
                        stripeSubscriptionStatus: subscription.status,
                        stripeCurrentPeriodEnd: subscription.current_period_end
                            ? new Date(subscription.current_period_end * 1000)
                            : null,
                    },
                });

                console.log(`[stripe] subscription activated for org ${orgId}`);
                break;
            }

            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const { orgId, status } = await applyCurrentSubscriptionState(
                    subscription.id
                );
                console.log(
                    `[stripe] ${event.type} -> org ${orgId} status ${status}`
                );
                break;
            }

            case "invoice.payment_succeeded":
            case "invoice.payment_failed": {
                const invoice = event.data.object as InvoiceWithSubscription;
                const subscriptionId = invoice.subscription as string | null;

                // A one-off invoice with no subscription is genuinely not ours.
                if (!subscriptionId) {
                    console.log(
                        `[stripe] ${event.type} with no subscription, ignoring`
                    );
                    break;
                }

                const { orgId, status } = await applyCurrentSubscriptionState(
                    subscriptionId
                );
                console.log(
                    `[stripe] ${event.type} -> org ${orgId} status ${status}`
                );
                break;
            }

            default:
                console.log(`[stripe] unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        // Returning 500 makes Stripe retry with backoff and surfaces the failure
        // in the Stripe dashboard. Previously these paths returned 200, so a
        // paid customer could silently never be upgraded.
        console.error(`[stripe] handler failed for ${event.type}:`, error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}
