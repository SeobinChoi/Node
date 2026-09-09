import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveDemoArtifact } = vi.hoisted(() => ({ saveDemoArtifact: vi.fn() }));
vi.mock("@/lib/ai/public-demo-service", () => ({
  listDemoArtifacts: vi.fn(),
  normalizeDemoService: (service: string) => service,
  saveDemoArtifact,
}));

import { POST } from "@/app/api/demo/artifacts/route";
import { OPS_RADAR_SCENARIOS } from "@/lib/demo/ops-radar-scenario";
import { serializeOpsRadarSnapshot } from "@/lib/demo/ops-radar-snapshot";

const request = (body: unknown, ip: string) => new NextRequest("http://localhost/api/demo/artifacts", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": ip },
  body: JSON.stringify(body),
});
const result = { title: "저장본", summary: "요약", markdown: "본문" };

describe("Ops Radar artifact route validation", () => {
  beforeEach(() => {
    saveDemoArtifact.mockReset();
    saveDemoArtifact.mockResolvedValue({ id: "saved" });
  });

  it("rejects malformed anonymous Ops Radar snapshots before the DB write", async () => {
    const response = await POST(request({ service: "opsRadar", sourceText: "not-json", result }, "artifact-invalid"));
    expect(response.status).toBe(400);
    expect(saveDemoArtifact).not.toHaveBeenCalled();
  });

  it("strips unknown result fields before the DB write", async () => {
    const scenario = OPS_RADAR_SCENARIOS[0];
    const sourceText = serializeOpsRadarSnapshot({ scenarioId: "night-comms", scenarioTitle: scenario.title, tasks: scenario.tasks });
    const response = await POST(request({ service: "opsRadar", sourceText, result: { ...result, oversized: "discard" } }, "artifact-valid"));
    expect(response.status).toBe(200);
    expect(saveDemoArtifact).toHaveBeenCalledWith({ artifactId: "ops-radar-night-comms", service: "opsRadar", sourceText, result });
  });

  it("rate-limits anonymous writes", async () => {
    let response: Response | undefined;
    for (let index = 0; index < 13; index += 1) {
      response = await POST(request({ service: "opsRadar", sourceText: "bad", result }, "artifact-rate-limit"));
    }
    expect(response?.status).toBe(429);
  });
});
