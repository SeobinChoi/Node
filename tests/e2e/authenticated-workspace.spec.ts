import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

const runDbE2E = process.env.RUN_DB_E2E === "1";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3000}`;

test.describe("authenticated workspace flow", () => {
  test.skip(!runDbE2E, "Set RUN_DB_E2E=1 with a disposable DATABASE_URL and AUTH_SECRET to run DB-backed e2e tests.");

  test("authenticated user can reach workspace projects and task graph", async ({ page, context }) => {
    test.setTimeout(120_000);

    const now = Date.now();
    const email = `e2e-${now}@node.local`;
    const sessionToken = await encode({
      token: {
        sub: `e2e-user-${now}`,
        name: "E2E User",
        email,
      },
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
    });

    const user = await prisma.user.create({
      data: {
        id: `e2e-user-${now}`,
        name: "E2E User",
        email,
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: `E2E Org ${now}`,
        ownerId: user.id,
        inviteCode: `e2e-${now}`,
      },
    });

    const team = await prisma.team.create({
      data: {
        orgId: org.id,
        name: "Default",
        isDefault: true,
      },
    });

    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    await prisma.teamMember.create({
      data: {
        orgId: org.id,
        teamId: team.id,
        userId: user.id,
        role: "LEAD",
      },
    });

    const project = await prisma.project.create({
      data: {
        orgId: org.id,
        ownerId: user.id,
        primaryTeamId: team.id,
        name: `E2E Project ${now}`,
      },
    });

    await prisma.projectMember.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        userId: user.id,
        role: "PROJECT_ADMIN",
      },
    });

    const keyboardNode = await prisma.node.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        teamId: team.id,
        ownerId: user.id,
        title: "Keyboard Delete Task",
        description: "Created for keyboard deletion coverage",
      },
    });

    const sheetNode = await prisma.node.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        teamId: team.id,
        ownerId: user.id,
        title: "E2E Task",
        description: "Created for detail sheet deletion coverage",
      },
    });

    await context.addCookies([
      {
        name: "authjs.session-token",
        value: sessionToken,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    ]);

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/org/${org.id}/projects`);
      await expect(page.getByRole("button", { name: "Open workspace navigation" })).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Open workspace navigation" }).click();
      await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Inbox" })).toBeVisible();
      await page.getByRole("link", { name: "Projects" }).click();
      await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toHaveCount(0);
      await expect(page.getByRole("link").filter({ hasText: project.name }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("link", { name: /New Project/ })).toBeVisible();

      await page.goto(`/org/${org.id}/projects/${project.id}/graph?nodeId=${sheetNode.id}`);
      await expect(page.getByRole("button", { name: "Open workspace navigation" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Saved").first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole("heading", { name: "E2E Task" }).click();
      await page.locator('button[aria-label="Open task details"]').click();
      await expect(page.getByRole("button", { name: "Delete node" })).toBeVisible();

      await page.setViewportSize({ width: 1280, height: 720 });

      await page.goto(`/org/${org.id}/projects/${project.id}/graph?nodeId=${sheetNode.id}`);
      await expect(page.getByText("Saved").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "Keyboard Delete Task" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "E2E Task" })).toBeVisible({ timeout: 15_000 });

      await page.getByRole("heading", { name: "Keyboard Delete Task" }).click();
      await page.keyboard.press("Delete");

      await expect(page.getByRole("heading", { name: "Keyboard Delete Task" })).toHaveCount(0, { timeout: 15_000 });
      await expect.poll(async () => page.evaluate(
        async ({ projectId, nodeId }) => {
          const response = await fetch(`/api/projects/${projectId}/graph`);
          if (!response.ok) return `status:${response.status}`;
          const graph = await response.json() as { nodes: Array<{ id: string }> };
          return graph.nodes.some((candidate) => candidate.id === nodeId);
        },
        { projectId: project.id, nodeId: keyboardNode.id }
      ), { timeout: 15_000 }).toBe(false);

      await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
      await expect(page.getByRole("heading", { name: "Keyboard Delete Task" })).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => page.evaluate(
        async ({ projectId, nodeId }) => {
          const response = await fetch(`/api/projects/${projectId}/graph`);
          if (!response.ok) return `status:${response.status}`;
          const graph = await response.json() as { nodes: Array<{ id: string }> };
          return graph.nodes.some((candidate) => candidate.id === nodeId);
        },
        { projectId: project.id, nodeId: keyboardNode.id }
      ), { timeout: 15_000 }).toBe(true);

      await page.getByRole("heading", { name: "E2E Task" }).click();
      await page.locator('button[aria-label="Open task details"]').click();
      await expect(page.getByRole("button", { name: "Delete node" })).toBeVisible();

      await page.getByRole("button", { name: "Delete node" }).click();

      await expect(page.getByRole("heading", { name: "E2E Task" })).toHaveCount(0, { timeout: 15_000 });
      await expect.poll(async () => page.evaluate(
        async ({ projectId, nodeId }) => {
          const response = await fetch(`/api/projects/${projectId}/graph`);
          if (!response.ok) return `status:${response.status}`;
          const graph = await response.json() as { nodes: Array<{ id: string }> };
          return graph.nodes.some((candidate) => candidate.id === nodeId);
        },
        { projectId: project.id, nodeId: sheetNode.id }
      ), { timeout: 15_000 }).toBe(false);
    } finally {
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => null);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
      await prisma.$disconnect();
    }
  });
});
