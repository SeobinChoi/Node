import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import {
  addAuthCookie,
  cleanupWorkspace,
  seedDependsOnEdge,
  seedNode,
  seedWorkspace,
  type SeededWorkspace,
} from "./_helpers";

const runDbE2E = process.env.RUN_DB_E2E === "1";

test.describe("project list/summary view (목록)", () => {
  test.skip(!runDbE2E, "Set RUN_DB_E2E=1 with a disposable DATABASE_URL and AUTH_SECRET to run DB-backed e2e tests.");

  test("renders progress rollup, grouped tasks, overdue + blocked, and row-to-graph focus", async ({ page, context }) => {
    test.setTimeout(120_000);

    let ws: SeededWorkspace | null = null;
    try {
      ws = await seedWorkspace("e2e-listview");

      const parent = await seedNode(ws, { title: "세부과제 A", positionX: 0, positionY: 0 });
      await seedNode(ws, {
        title: "완료 업무",
        parentNodeId: parent.id,
        manualStatus: "DONE",
        ownerId: ws.user.id,
        positionX: 40,
        positionY: 80,
      });
      const doingNode = await seedNode(ws, {
        title: "진행 업무",
        parentNodeId: parent.id,
        manualStatus: "DOING",
        ownerId: ws.user.id,
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        positionX: 40,
        positionY: 260,
      });
      await seedNode(ws, {
        title: "지연 업무",
        parentNodeId: parent.id,
        manualStatus: "TODO",
        ownerId: ws.user.id,
        dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // overdue
        positionX: 40,
        positionY: 440,
      });
      const blockedNode = await seedNode(ws, {
        title: "막힘 업무",
        parentNodeId: parent.id,
        manualStatus: "TODO",
        ownerId: ws.user.id,
        positionX: 40,
        positionY: 620,
      });
      // 막힘 업무 DEPENDS_ON 진행 업무 (not DONE) => computed BLOCKED
      await seedDependsOnEdge(ws, blockedNode.id, doingNode.id);

      await addAuthCookie(context, ws.user);

      // Warm + load the graph page; the 그래프|목록 toggle only renders once graph data loads.
      await page.goto(`/org/${ws.orgId}/projects/${ws.projectId}/graph`);
      await expect(page.getByRole("button", { name: "목록" })).toBeVisible({ timeout: 45_000 });

      // Switch to the list view
      await page.getByRole("button", { name: "목록" }).click();

      // Progress rollup
      await expect(page.getByText("사업 진척 현황")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("완료율")).toBeVisible();
      await expect(page.getByText("20%")).toBeVisible(); // 1 DONE of 5 total nodes

      // Grouped under the parent 세부과제
      await expect(page.getByText("세부과제 A")).toBeVisible();
      await expect(page.getByText("완료 업무")).toBeVisible();

      // Status badges
      await expect(page.getByText("완료", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("막힘", { exact: true }).first()).toBeVisible();

      // Overdue indicator (지연 N일 in 비고)
      await expect(page.getByText(/지연 \d+일/)).toBeVisible();

      // Owner name shown in a row
      await expect(page.getByText("E2E Admin").first()).toBeVisible();

      // Row click switches back to the graph (list summary disappears)
      await page.getByText("완료 업무").click();
      await expect(page.getByText("사업 진척 현황")).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "보드" })).toBeVisible();
    } finally {
      const userIds = ws ? [ws.user.id] : [];
      await cleanupWorkspace(ws?.orgId ?? null, userIds);
      await prisma.$disconnect();
    }
  });
});
