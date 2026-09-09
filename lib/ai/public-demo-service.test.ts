import { beforeEach, describe, expect, it, vi } from "vitest";

const generateMilitaryAIJson = vi.fn();

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/ai/military-documents", () => ({
  generateMilitaryAIJson: (...args: unknown[]) => generateMilitaryAIJson(...args),
  scanMilitarySensitiveContent: () => [],
}));

const { generatePublicDemoResult } = await import("@/lib/ai/public-demo-service");

const sourceText = [
  "[공개 시연 · 비식별 합성 데이터]",
  "documentType: command (지휘관 상황보고)",
  "scenario: 야간 통신 점검",
  "bottlenecks (1건):",
  "- 점검표 제출 | 사유 기한 경과 | 영향 4건",
].join("\n");

describe("opsRadar public demo generation", () => {
  beforeEach(() => {
    generateMilitaryAIJson.mockReset();
  });

  it("routes Ops Radar report requests through the shared Gemini generator", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: {
        title: "야간 통신 점검 상황보고",
        summary: "점검표 제출 지연이 후속 4건을 막고 있습니다.",
        sections: [{ heading: "현재 상황", body: "점검표 제출이 기한을 경과했습니다." }],
        actionItems: [{ task: "점검표 회수", owner: "운영반", dueDate: "2026-09-07" }],
      },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    const result = await generatePublicDemoResult({ service: "opsRadar", mode: "command", sourceText });

    expect(generateMilitaryAIJson).toHaveBeenCalledTimes(1);
    const request = generateMilitaryAIJson.mock.calls[0][0] as Record<string, unknown>;
    expect(request.sourceText).toBe(sourceText);
    expect(String(request.userInstruction)).toContain("지휘관 상황보고");
    expect((request.metadata as Record<string, unknown>).service).toBe("opsRadar");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.title).toBe("야간 통신 점검 상황보고");
    expect(result.sections[0].label).toBe("현재 상황");
    expect(result.actions[0]).toContain("점검표 회수");
  });

  it("varies the instruction per Ops Radar report type", async () => {
    generateMilitaryAIJson.mockResolvedValue({ generated: { title: "주간", summary: "요약" }, securityFlags: [], model: "gemini-2.5-flash" });

    await generatePublicDemoResult({ service: "opsRadar", mode: "weekly", sourceText });
    expect(String(generateMilitaryAIJson.mock.calls[0][0].userInstruction)).toContain("주간 진행보고");

    await generatePublicDemoResult({ service: "opsRadar", mode: "action", sourceText });
    expect(String(generateMilitaryAIJson.mock.calls[1][0].userInstruction)).toContain("병목 조치계획");
  });

  it("falls back to a usable deterministic Ops Radar document when the provider fails", async () => {
    generateMilitaryAIJson.mockImplementation(async () => {
      throw new Error("provider down");
    });

    const result = await generatePublicDemoResult({ service: "opsRadar", mode: "action", sourceText });

    expect(result.model).toBe("deterministic-demo-fallback");
    expect(result.title).toBeTruthy();
    expect(result.summary).toBeTruthy();
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections.map((section) => section.body).join(" ")).toContain("기한 경과");
    expect(result.sections.map((section) => section.body).join(" ")).toContain("영향 4건");
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.markdown).toContain(result.title);
  });

  it("labels a provider parse failure as deterministic fallback", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: { title: "AI response parsing failed" },
      securityFlags: [],
      model: "gemini-3.6-flash",
    });

    const result = await generatePublicDemoResult({ service: "opsRadar", mode: "command", sourceText });

    expect(result.model).toBe("deterministic-demo-fallback");
    expect(result.title).not.toBe("AI response parsing failed");
  });

  it("does not attribute malformed provider output to Gemini", async () => {
    generateMilitaryAIJson.mockResolvedValue({ generated: {}, securityFlags: [], model: "gemini-3.6-flash" });

    const result = await generatePublicDemoResult({ service: "opsRadar", mode: "command", sourceText });

    expect(result.model).toBe("deterministic-demo-fallback");
    expect(result.title).toContain("지휘관 상황보고");
    expect(result.sections.map((section) => section.body).join(" ")).toContain("기한 경과");
  });
});
