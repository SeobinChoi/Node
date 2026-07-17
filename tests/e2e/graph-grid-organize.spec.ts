import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { addAuthCookie, cleanupWorkspace, seedNode, seedWorkspace, type SeededWorkspace } from "./_helpers";

const runDbE2E = process.env.RUN_DB_E2E === "1";

test.describe("graph snap-cell grid background", () => {
  test.skip(!runDbE2E, "Set RUN_DB_E2E=1 with a disposable DATABASE_URL and AUTH_SECRET to run DB-backed e2e tests.");

  test("renders the chessboard grid background behind the canvas with nodes", async ({ page, context }) => {
    test.setTimeout(120_000);

    let ws: SeededWorkspace | null = null;
    try {
      ws = await seedWorkspace("e2e-grid");
      await seedNode(ws, { title: "격자 노드 1", positionX: 0, positionY: 0 });
      await seedNode(ws, { title: "격자 노드 2", positionX: 340, positionY: 0 });
      await seedNode(ws, { title: "격자 노드 3", positionX: 680, positionY: 180 });

      await addAuthCookie(context, ws.user);
      await page.goto(`/org/${ws.orgId}/projects/${ws.projectId}/graph`);

      // Graph loaded once the 브리핑|보드|목록 toggle renders.
      await expect(page.getByRole("button", { name: "목록" })).toBeVisible({ timeout: 45_000 });

      // 기본 화면이 브리핑이므로 보드 탭으로 전환한다.
      await page.getByRole("button", { name: "보드" }).click();

      // The layered React Flow background (dots + snap-cell grid lines) is drawn behind the canvas.
      const backgrounds = page.locator(".react-flow__background");
      await expect(backgrounds.first()).toBeVisible({ timeout: 15_000 });
      expect(await backgrounds.count()).toBeGreaterThanOrEqual(1);

      // Seeded nodes render on the canvas.
      await expect(page.getByText("격자 노드 1")).toBeVisible();
      await expect(page.getByText("격자 노드 2")).toBeVisible();

      // Snap-to-grid is enabled on the flow (the toolbar Organize→GRID / drag-snap paths depend on it).
      await expect(page.locator(".react-flow")).toBeVisible();
    } finally {
      const userIds = ws ? [ws.user.id] : [];
      await cleanupWorkspace(ws?.orgId ?? null, userIds);
      await prisma.$disconnect();
    }
  });
});
