import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function pathFor(relativePath) {
  return join(root, relativePath);
}

function read(relativePath) {
  return readFileSync(pathFor(relativePath), "utf8");
}

function check(label, condition) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures.push(label);
    console.error(`FAIL ${label}`);
  }
}

function exists(relativePath) {
  return existsSync(pathFor(relativePath));
}

function includes(relativePath, text) {
  return read(relativePath).includes(text);
}

function orderedIncludes(relativePath, texts) {
  const content = read(relativePath);
  let cursor = 0;
  for (const text of texts) {
    const index = content.indexOf(text, cursor);
    if (index === -1) return false;
    cursor = index + text.length;
  }
  return true;
}

function occurrenceCount(relativePath, text) {
  return read(relativePath).split(text).length - 1;
}

check("task page schema model exists", includes("prisma/schema.prisma", "model NodePage"));
check("task comment schema model exists", includes("prisma/schema.prisma", "model NodeComment"));
check("task attachment schema model exists", includes("prisma/schema.prisma", "model NodeAttachment"));
check("task collaboration migration exists", exists("prisma/migrations/20260428153000_node_task_collaboration/migration.sql"));
check("team membership migration exists", exists("prisma/migrations/20260406123000_teamspace_membership_overhaul/migration.sql"));
check("node hierarchy migration exists", exists("prisma/migrations/20260430103000_node_hierarchy/migration.sql"));
check("node hierarchy schema field exists", includes("prisma/schema.prisma", "parentNodeId"));

check("node page API exists", exists("app/api/nodes/[nodeId]/page/route.ts"));
check("node comments API exists", exists("app/api/nodes/[nodeId]/comments/route.ts"));
check("node attachments API exists", exists("app/api/nodes/[nodeId]/attachments/route.ts"));
check("attachment upload validates file type and size", includes("app/api/nodes/[nodeId]/attachments/route.ts", "assertAllowedAttachment"));
check("node page editing requires project edit access", includes("app/api/nodes/[nodeId]/page/route.ts", "requireProjectEdit"));
check("node page viewing requires project view access", includes("app/api/nodes/[nodeId]/page/route.ts", "requireProjectView"));
check("mentions are resolved for task page edits", includes("app/api/nodes/[nodeId]/page/route.ts", "resolveMentionedProjectUsers"));
check("mentions are resolved for comments", includes("app/api/nodes/[nodeId]/comments/route.ts", "resolveMentionedProjectUsers"));

check("task workspace UI has page tab", includes("components/graph/NodeDetailSheet.tsx", "Page"));
check("task workspace UI has comments tab", includes("components/graph/NodeDetailSheet.tsx", "Comments"));
check("task workspace UI has files tab", includes("components/graph/NodeDetailSheet.tsx", 'value="files"'));
check("task workspace UI has activity tab", includes("components/graph/NodeDetailSheet.tsx", "Activity"));
check("graph supports parented child nodes", includes("components/graph/GraphCanvas.tsx", "parentNode"));
check("graph supports dragging nodes into containers", includes("components/graph/GraphCanvas.tsx", "Moved inside"));
check("graph creates new connections as default dependencies", includes("components/graph/GraphCanvas.tsx", "EdgeRelation.DEPENDS_ON"));
check("graph no longer opens relation picker on new connection", !includes("components/graph/GraphCanvas.tsx", "Define Relationship"));
check("graph warns before leaving with pending saves", includes("components/graph/GraphCanvas.tsx", "beforeunload"));
check("node creation uses optimistic graph cache", includes("components/graph/AddNodeDialog.tsx", "Node added. Saving..."));

check("military AI shared helper exists", exists("lib/ai/military-documents.ts"));
check("military AI helper scans sensitive content", includes("lib/ai/military-documents.ts", "scanMilitarySensitiveContent"));
check("military AI helper uses JSON response format", includes("lib/ai/military-documents.ts", 'response_format: { type: "json_object" }'));
check("military documents helper smoke exists", exists("scripts/smoke-military-documents.ts"));
check("military documents helper smoke covers sensitive scans", includes("scripts/smoke-military-documents.ts", "scanMilitarySensitiveContent"));
check("military console format helper exists", exists("lib/ai/military-console-format.ts"));
check("military console format helper exports markdown conversion", includes("lib/ai/military-console-format.ts", "generatedToMarkdown"));
check("military console format smoke exists", exists("scripts/smoke-military-console-format.ts"));
check("military console request helper exists", exists("lib/ai/military-console-request.ts"));
check("military console request helper exports request builder", includes("lib/ai/military-console-request.ts", "buildMilitaryAIRequestBody"));
check("military console request smoke exists", exists("scripts/smoke-military-console-request.ts"));
check("military console request smoke covers security scan", includes("scripts/smoke-military-console-request.ts", "securityScan"));
check("military AI TypeScript import/syntax smoke exists", exists("scripts/smoke-military-ai-ts-syntax.mjs"));
check("military AI TypeScript import/syntax smoke covers console UI", includes("scripts/smoke-military-ai-ts-syntax.mjs", "components/project/MilitaryAIConsole.tsx"));
check("military AI TypeScript import/syntax smoke covers request helper", includes("scripts/smoke-military-ai-ts-syntax.mjs", "lib/ai/military-console-request.ts"));
check("public demo TypeScript import/syntax smoke exists", exists("scripts/smoke-public-demo-ts-syntax.mjs"));
check("public demo TypeScript import/syntax smoke covers public demo APIs", includes("scripts/smoke-public-demo-ts-syntax.mjs", "app/api/demo/generate/route.ts") && includes("scripts/smoke-public-demo-ts-syntax.mjs", "app/api/demo/artifacts/route.ts"));
check("public demo backend helper exists", exists("lib/ai/public-demo-service.ts"));
check("public demo backend creates artifact table", includes("lib/ai/public-demo-service.ts", "CREATE TABLE IF NOT EXISTS public_demo_artifacts"));
check("public demo backend calls Military AI generation helper", includes("lib/ai/public-demo-service.ts", "generateMilitaryAIJson"));
check("public demo generate API exists", exists("app/api/demo/generate/route.ts"));
check("public demo artifact API exists", exists("app/api/demo/artifacts/route.ts"));
check("public demo UI calls generate API", includes("components/project/PublicServiceDemoClient.tsx", "/api/demo/generate") && includes("components/project/MilitaryAIDemoClient.tsx", "/api/demo/generate"));
check("public demo UI calls artifact API", includes("components/project/PublicServiceDemoClient.tsx", "/api/demo/artifacts") && includes("components/project/MilitaryAIDemoClient.tsx", "/api/demo/artifacts"));
check("public demo shared header exists", exists("components/project/PublicDemoHeader.tsx"));
check("public demo shared header covers all four routes", includes("components/project/PublicDemoHeader.tsx", "/military-ai-demo") && includes("components/project/PublicDemoHeader.tsx", "/ops-radar-demo") && includes("components/project/PublicDemoHeader.tsx", "/admin-doc-demo") && includes("components/project/PublicDemoHeader.tsx", "/after-action-demo"));
check("public demo service pages use shared header", occurrenceCount("components/project/PublicServiceDemoClient.tsx", "PublicDemoHeader") >= 4 && occurrenceCount("components/project/MilitaryAIDemoClient.tsx", "PublicDemoHeader") >= 2);
check("public demo legacy per-page nav is removed", !includes("components/project/PublicServiceDemoClient.tsx", "function PublicNav"));
check("military admin document API exists", exists("app/api/ai/admin-document/route.ts"));
check("military admin document API logs generation", includes("app/api/ai/admin-document/route.ts", "GENERATE_ADMIN_DOCUMENT"));
check("military meeting summary API exists", exists("app/api/ai/meeting-summary/route.ts"));
check("military meeting summary API logs generation", includes("app/api/ai/meeting-summary/route.ts", "GENERATE_MEETING_SUMMARY"));
check("military AAR summary API exists", exists("app/api/ai/aar-summary/route.ts"));
check("military AAR summary API logs generation", includes("app/api/ai/aar-summary/route.ts", "GENERATE_AAR_SUMMARY"));
check("military weekly report API exists", exists("app/api/ai/weekly-report/route.ts"));
check("military weekly report API logs generation", includes("app/api/ai/weekly-report/route.ts", "GENERATE_WEEKLY_REPORT"));
check("military security scan API exists", exists("app/api/ai/security-scan/route.ts"));
check("military security scan API returns local flags", includes("app/api/ai/security-scan/route.ts", "localFlags"));
check("military AI console UI exists", exists("components/project/MilitaryAIConsole.tsx"));
check("military AI console calls admin API", includes("components/project/MilitaryAIConsole.tsx", "/api/ai/admin-document"));
check("military AI console calls meeting API", includes("components/project/MilitaryAIConsole.tsx", "/api/ai/meeting-summary"));
check("military AI console calls AAR API", includes("components/project/MilitaryAIConsole.tsx", "/api/ai/aar-summary"));
check("military AI console calls weekly API", includes("components/project/MilitaryAIConsole.tsx", "/api/ai/weekly-report"));
check("military AI console calls security API", includes("components/project/MilitaryAIConsole.tsx", "/api/ai/security-scan"));
check("military AI console imports markdown helper", includes("components/project/MilitaryAIConsole.tsx", "@/lib/ai/military-console-format"));
check("military AI console imports request helper", includes("components/project/MilitaryAIConsole.tsx", "@/lib/ai/military-console-request"));
check("military AI console can save generated output as node", includes("components/project/MilitaryAIConsole.tsx", "handleSaveAsNode"));
check("military AI console creates project nodes", includes("components/project/MilitaryAIConsole.tsx", "/api/projects/${projectId}/nodes"));
check("military AI console saves generated node pages", includes("components/project/MilitaryAIConsole.tsx", "/api/nodes/${nodeId}/page"));
check("military AI console persists generated markdown", includes("components/project/MilitaryAIConsole.tsx", "generatedToMarkdown(activeConfig.label, result.generated, flags)"));
check("military AI console saves node page after node creation", orderedIncludes("components/project/MilitaryAIConsole.tsx", [
  "const createRes = await fetch(`/api/projects/${projectId}/nodes`",
  "const created = await createRes.json();",
  "const nodeId = String(created.id || \"\");",
  "const pageRes = await fetch(`/api/nodes/${nodeId}/page`",
]));
check("military AI console exposes saved node id", includes("components/project/MilitaryAIConsole.tsx", "setSavedNodeId(nodeId)") && includes("components/project/MilitaryAIConsole.tsx", "Saved as node"));
check("military AI console clears stale saved node id", occurrenceCount("components/project/MilitaryAIConsole.tsx", "setSavedNodeId(null)") >= 2);
check("project military AI page exists", exists("app/(dashboard)/projects/[projectId]/ai/page.tsx"));
check("org project military AI page exists", exists("app/(dashboard)/org/[orgId]/projects/[projectId]/ai/page.tsx"));
check("project layout exposes military AI tab", includes("app/(dashboard)/projects/[projectId]/layout.tsx", `/projects/\${projectId}/ai`));
check("public smoke protects military AI routes", includes("tests/e2e/public-smoke.spec.ts", "military AI project routes redirect unauthenticated users to login") && includes("tests/e2e/public-smoke.spec.ts", "/projects/e2e-project/ai") && includes("tests/e2e/public-smoke.spec.ts", "/org/e2e-org/projects/e2e-project/ai"));

check("Supabase URL env documented", includes(".env.example", "SUPABASE_URL"));
check("Supabase service role env documented", includes(".env.example", "SUPABASE_SERVICE_ROLE_KEY"));
check("Supabase storage bucket env documented", includes(".env.example", "SUPABASE_STORAGE_BUCKET"));
check("storage helper uses signed download URLs", includes("lib/utils/node-collaboration.ts", "/storage/v1/object/sign/"));

check("project sharing uses current invites endpoint", includes("components/project/ShareModal.tsx", "/api/projects/${projectId}/invites"));
check("project roles use editor/viewer/admin scope", includes("components/project/ShareModal.tsx", "PROJECT_ADMIN"));
check("test make-user API is removed", !exists("app/api/test/make-user/route.ts"));
check("mock workspace data is removed", !exists("lib/mock-workspace-data.ts"));

check("team-target notification read path exists", includes("app/api/notifications/[id]/read/route.ts", "targetTeamId"));
check("unified inbox exposes notification project navigation", includes("app/api/inbox/unified/route.ts", "projectId"));
check("workspace project listing uses real workspace structure", includes("app/(dashboard)/org/[orgId]/projects/page.tsx", "useWorkspaceStructure"));

if (failures.length > 0) {
  console.error(`\nSmoke verification failed: ${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log("\nSmoke verification passed.");
