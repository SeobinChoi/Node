import { prisma } from "@/lib/db/prisma";

const FREE_NODE_LIMIT = 20;

/**
 * Check if an organization has an active subscription (Pro tier)
 */
export async function isOrgPro(orgId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
            stripeSubscriptionStatus: true,
            stripeCurrentPeriodEnd: true,
        },
    });

    if (!org) return false;

    const validStatuses = ["active", "trialing"];
    const hasValidStatus =
        org.stripeSubscriptionStatus &&
        validStatuses.includes(org.stripeSubscriptionStatus);

    const isNotExpired =
        !org.stripeCurrentPeriodEnd ||
        org.stripeCurrentPeriodEnd.getTime() + 86_400_000 > Date.now(); // Add 1 day grace period

    return Boolean(hasValidStatus && isNotExpired);
}

/**
 * Count the nodes that actually exist in an organization.
 *
 * The denormalized `organization.nodeCount` column is NOT a reliable source of
 * truth: bulk import / template creates historically skipped the increment, node
 * deletes decrement without a floor (so it drifts negative), and cascade deletes
 * from project/org removal never decrement it at all. Enforcement therefore
 * counts real rows — the same thing the billing page already displays — so no
 * write path can silently unlock the paid tier by desyncing a counter.
 */
async function countOrgNodes(orgId: string): Promise<number> {
    return prisma.node.count({ where: { orgId } });
}

/**
 * Check if an organization can create `addCount` more nodes.
 * @param orgId organization to check
 * @param addCount how many nodes are about to be created (default 1)
 * @throws Error if creating them would exceed the free-tier limit
 */
export async function assertWithinNodeLimit(orgId: string, addCount = 1): Promise<void> {
    const isPro = await isOrgPro(orgId);

    if (isPro) {
        // Pro users have unlimited nodes
        return;
    }

    const currentCount = await countOrgNodes(orgId);

    if (currentCount + addCount > FREE_NODE_LIMIT) {
        throw new Error(
            `Free tier limit reached. You can create up to ${FREE_NODE_LIMIT} nodes. Please upgrade to continue.`
        );
    }
}

/**
 * Check if an organization has reached the node limit
 * @returns true if limit is reached, false otherwise
 */
export async function hasReachedNodeLimit(orgId: string): Promise<boolean> {
    const isPro = await isOrgPro(orgId);

    if (isPro) {
        return false;
    }

    const currentCount = await countOrgNodes(orgId);

    return currentCount >= FREE_NODE_LIMIT;
}
