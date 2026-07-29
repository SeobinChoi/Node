import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client so these stay pure unit tests (no DB). The billing gate
// must be driven by the REAL node count, not the drift-prone denormalized
// organization.nodeCount column — these tests lock that behavior in.
const { nodeCount, orgFindUnique } = vi.hoisted(() => ({
  nodeCount: vi.fn(),
  orgFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    node: { count: nodeCount },
    organization: { findUnique: orgFindUnique },
  },
}));

import { assertWithinNodeLimit, hasReachedNodeLimit, isOrgPro } from "@/lib/subscription";

const FREE_LIMIT = 20;
const DAY_MS = 86_400_000;

function makeFreeOrg() {
  // No active subscription => free tier.
  orgFindUnique.mockResolvedValue({
    stripeSubscriptionStatus: null,
    stripeCurrentPeriodEnd: null,
  });
}

function makeProOrg() {
  orgFindUnique.mockResolvedValue({
    stripeSubscriptionStatus: "active",
    stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertWithinNodeLimit", () => {
  it("never blocks a Pro org and does not even count nodes", async () => {
    makeProOrg();
    await expect(assertWithinNodeLimit("org", 1000)).resolves.toBeUndefined();
    expect(nodeCount).not.toHaveBeenCalled();
  });

  it("allows a free org that stays within the limit", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(10);
    await expect(assertWithinNodeLimit("org", 1)).resolves.toBeUndefined();
  });

  it("allows creation that lands exactly on the limit", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(15);
    await expect(assertWithinNodeLimit("org", 5)).resolves.toBeUndefined();
  });

  it("blocks the create that would exceed the limit", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(FREE_LIMIT);
    await expect(assertWithinNodeLimit("org", 1)).rejects.toThrow(/Free tier limit reached/);
  });

  it("respects addCount so batch creates cannot straddle the limit", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(15);
    await expect(assertWithinNodeLimit("org", 6)).rejects.toThrow(/Free tier limit reached/);
  });

  it("blocks a large bulk import on an empty free org (regression: the bulk-import leak)", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(0);
    await expect(assertWithinNodeLimit("org", 200)).rejects.toThrow(/Free tier limit reached/);
  });

  it("counts real nodes scoped by orgId, not the denormalized counter", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(5);
    await assertWithinNodeLimit("org-123", 1);
    expect(nodeCount).toHaveBeenCalledWith({ where: { orgId: "org-123" } });
  });
});

describe("isOrgPro", () => {
  function orgWith(status: string | null, periodEndOffsetMs: number | null) {
    orgFindUnique.mockResolvedValue({
      stripeSubscriptionStatus: status,
      stripeCurrentPeriodEnd:
        periodEndOffsetMs === null ? null : new Date(Date.now() + periodEndOffsetMs),
    });
  }

  it("is false for an org with no subscription", async () => {
    orgWith(null, null);
    await expect(isOrgPro("org")).resolves.toBe(false);
  });

  it("is true for an active subscription in its paid period", async () => {
    orgWith("active", 10 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(true);
  });

  it("is true while trialing", async () => {
    orgWith("trialing", 5 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(true);
  });

  it("is false once an active subscription is well past its period end", async () => {
    orgWith("active", -10 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(false);
  });

  it("keeps access during dunning so Stripe retries can still succeed", async () => {
    // Payment failed 3 days ago; Stripe Smart Retries are still running.
    orgWith("past_due", -3 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(true);
  });

  it("drops access once the dunning window has fully elapsed", async () => {
    orgWith("past_due", -20 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(false);
  });

  it("is false for canceled and unpaid subscriptions", async () => {
    orgWith("canceled", 10 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(false);

    orgWith("unpaid", 10 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(false);
  });

  it("is false for an incomplete checkout that never paid", async () => {
    orgWith("incomplete", 10 * DAY_MS);
    await expect(isOrgPro("org")).resolves.toBe(false);
  });
});

describe("hasReachedNodeLimit", () => {
  it("is false for a Pro org regardless of count", async () => {
    makeProOrg();
    await expect(hasReachedNodeLimit("org")).resolves.toBe(false);
  });

  it("is true when a free org is at the limit", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(FREE_LIMIT);
    await expect(hasReachedNodeLimit("org")).resolves.toBe(true);
  });

  it("is false when a free org is below the limit", async () => {
    makeFreeOrg();
    nodeCount.mockResolvedValue(FREE_LIMIT - 1);
    await expect(hasReachedNodeLimit("org")).resolves.toBe(false);
  });
});
