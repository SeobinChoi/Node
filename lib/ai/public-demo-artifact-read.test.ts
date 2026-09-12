import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma }));

const { listDemoArtifacts } = await import("@/lib/ai/public-demo-service");

describe("public demo artifact reads", () => {
  beforeEach(() => {
    prisma.$executeRawUnsafe.mockReset();
    prisma.$queryRaw.mockReset().mockResolvedValue([]);
  });

  it("does not create tables or indexes during GET-backed reads", async () => {
    await expect(listDemoArtifacts("militaryAi", 6)).resolves.toEqual([]);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
