import { request as playwrightRequest, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

// Shared e2e helpers: forge NextAuth JWT session cookies (Google OAuth is bypassed)
// and seed disposable org/project fixtures against the local Postgres `node_db`.
// Mirrors the inline setup previously copy-pasted across the DB-backed specs.

export const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3000}`;

export interface TestUser {
  id: string;
  name: string;
  email: string;
}

type SessionSalt = "authjs.session-token" | "__Secure-authjs.session-token";

export async function mintSessionToken(user: TestUser, salt: SessionSalt = "authjs.session-token") {
  return encode({
    token: { sub: user.id, name: user.name, email: user.email },
    secret: process.env.AUTH_SECRET!,
    salt,
  });
}

/** Add a NextAuth session cookie to a browser context so page navigations are authenticated. */
export async function addAuthCookie(context: BrowserContext, user: TestUser) {
  const value = await mintSessionToken(user, "authjs.session-token");
  await context.addCookies([
    {
      name: "authjs.session-token",
      value,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  ]);
}

/** Build an authenticated APIRequestContext for a user (both plain + secure cookies). */
export async function apiFor(user: TestUser): Promise<APIRequestContext> {
  const sessionToken = await mintSessionToken(user, "authjs.session-token");
  const secureSessionToken = await mintSessionToken(user, "__Secure-authjs.session-token");
  return playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      cookie: `authjs.session-token=${sessionToken}; __Secure-authjs.session-token=${secureSessionToken}`,
    },
  });
}

export interface SeededWorkspace {
  user: TestUser;
  orgId: string;
  teamId: string;
  projectId: string;
}

/** Seed an admin user + org + default team + project (caller is PROJECT_ADMIN). */
export async function seedWorkspace(prefix: string): Promise<SeededWorkspace> {
  const now = Date.now();
  const user: TestUser = {
    id: `${prefix}-${now}-admin`,
    name: "E2E Admin",
    email: `${prefix}-${now}-admin@node.local`,
  };
  await prisma.user.create({ data: user });

  const org = await prisma.organization.create({
    data: { name: `${prefix} Org ${now}`, ownerId: user.id, inviteCode: `${prefix}-${now}` },
  });
  const team = await prisma.team.create({
    data: { orgId: org.id, name: "Default", isDefault: true },
  });
  await prisma.orgMember.create({
    data: { orgId: org.id, userId: user.id, role: "ADMIN", status: "ACTIVE" },
  });
  await prisma.teamMember.create({
    data: { orgId: org.id, teamId: team.id, userId: user.id, role: "LEAD" },
  });
  const project = await prisma.project.create({
    data: { orgId: org.id, ownerId: user.id, primaryTeamId: team.id, name: `${prefix} Project ${now}` },
  });
  await prisma.projectMember.create({
    data: { orgId: org.id, projectId: project.id, userId: user.id, role: "PROJECT_ADMIN" },
  });

  return { user, orgId: org.id, teamId: team.id, projectId: project.id };
}

interface SeedNodeInput {
  title: string;
  parentNodeId?: string | null;
  manualStatus?: "TODO" | "DOING" | "DONE";
  ownerId?: string | null;
  dueAt?: Date | null;
  positionX?: number;
  positionY?: number;
}

/** Create a node and (if ownerId given) a matching NodeOwner row so it renders in owners lists. */
export async function seedNode(ws: SeededWorkspace, input: SeedNodeInput) {
  const node = await prisma.node.create({
    data: {
      orgId: ws.orgId,
      projectId: ws.projectId,
      teamId: ws.teamId,
      parentNodeId: input.parentNodeId ?? null,
      title: input.title,
      manualStatus: input.manualStatus ?? "TODO",
      ownerId: input.ownerId ?? null,
      dueAt: input.dueAt ?? null,
      positionX: input.positionX ?? null,
      positionY: input.positionY ?? null,
    },
  });
  if (input.ownerId) {
    await prisma.nodeOwner.create({ data: { nodeId: node.id, userId: input.ownerId } }).catch(() => null);
  }
  return node;
}

/** Create a DEPENDS_ON edge (from depends on to) so `from` computes BLOCKED while `to` is not DONE. */
export async function seedDependsOnEdge(ws: SeededWorkspace, fromNodeId: string, toNodeId: string) {
  return prisma.edge.create({
    data: { orgId: ws.orgId, projectId: ws.projectId, fromNodeId, toNodeId, relation: "DEPENDS_ON" },
  });
}

export async function cleanupWorkspace(orgId: string | null, userIds: string[]) {
  if (orgId) {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => null);
  }
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => null);
  }
}
