import { beforeEach, describe, expect, it, vi } from "vitest";
import { exampleById } from "@/lib/demo/public-document-examples";

const generateMilitaryAIJson = vi.fn();

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/ai/military-documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/military-documents")>();
  return { ...actual, generateMilitaryAIJson: (...args: unknown[]) => generateMilitaryAIJson(...args) };
});

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
    expect(request.provider).toBe("gemini");
    expect(request.maxTokens).toBe(3_000);
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

describe("adminDoc report vs approval Gemini contracts", () => {
  beforeEach(() => {
    generateMilitaryAIJson.mockReset();
  });

  it("sends distinct system prompt, response shape, and tool metadata for report vs approval", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: { title: "t", summary: "s", sections: [{ heading: "h", body: "b" }] },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    await generatePublicDemoResult({ service: "adminDoc", mode: "report", sourceText: "입력" });
    const reportRequest = generateMilitaryAIJson.mock.calls[0][0] as Record<string, unknown>;

    await generatePublicDemoResult({ service: "adminDoc", mode: "approval", sourceText: "입력" });
    const approvalRequest = generateMilitaryAIJson.mock.calls[1][0] as Record<string, unknown>;

    expect((reportRequest.metadata as Record<string, unknown>).tool).toBe("adminDocument");
    expect((approvalRequest.metadata as Record<string, unknown>).tool).toBe("approvalDocument");
    expect(reportRequest.systemPrompt).not.toBe(approvalRequest.systemPrompt);
    expect(reportRequest.responseShape).not.toBe(approvalRequest.responseShape);
  });

  it("preserves every validated generated section", async () => {
    const sections = Array.from({ length: 7 }, (_, index) => ({ heading: `항목 ${index + 1}`, body: `본문 ${index + 1}` }));
    generateMilitaryAIJson.mockResolvedValue({
      generated: { title: "전체 항목", summary: "요약", sections },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    const result = await generatePublicDemoResult({ service: "adminDoc", mode: "report", sourceText: "입력" });

    expect(result.sections.map((section) => section.label)).toEqual(sections.map((section) => section.heading));
  });

  it("maps adminDoc security mode to securityScan", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: {
        title: "보안 검토",
        summary: "요약",
        riskLevel: "medium",
        recommendedRedactions: [{ category: "담당자", reason: "노출", replacement: "[담당자]" }],
        safeRewrite: "안전 문장",
      },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    await generatePublicDemoResult({ service: "adminDoc", mode: "security", sourceText: "입력" });
    const request = generateMilitaryAIJson.mock.calls[0][0] as Record<string, unknown>;
    expect((request.metadata as Record<string, unknown>).tool).toBe("securityScan");
  });
});

describe("workItems preserve generated owner/dueDate/risk", () => {
  beforeEach(() => {
    generateMilitaryAIJson.mockReset();
  });

  it("keeps the actual owner, dueDate, and risk from a meetingSummary actionItem instead of a fixed rotation", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: {
        title: "회의록",
        summary: "요약",
        decisions: [{ decision: "결정", owner: "기획관리계장", dueDate: "2026-12-01" }],
        actionItems: [{ task: "특수조치", owner: "고유담당자", dueDate: "2099-01-01", risk: "high" }],
        sections: [{ heading: "회의 개요", body: "내용" }],
      },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    const result = await generatePublicDemoResult({ service: "afterAction", mode: "actions", sourceText: "입력" });

    expect(result.workItems[0].owner).toBe("고유담당자");
    expect(result.workItems[0].dueDate).toBe("2099-01-01");
    expect(result.workItems[0].risk).toBe("high");
  });
});

describe("metrics are derived from the actual result", () => {
  beforeEach(() => {
    generateMilitaryAIJson.mockReset();
  });

  it("computes metrics from sections/actions/securityFlagCount instead of a static table", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: {
        title: "보고서",
        summary: "요약",
        sections: [
          { heading: "보고 목적", body: "목적" },
          { heading: "현황", body: "현황" },
        ],
        reviewChecklist: ["확인1", "확인2", "확인3"],
      },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    const result = await generatePublicDemoResult({ service: "adminDoc", mode: "report", sourceText: "입력" });

    expect(result.actions).toEqual(["확인1", "확인2", "확인3"]);
    const sectionCountMetric = result.metrics.find((m) => Number(m.value) === result.sections.length);
    const actionCountMetric = result.metrics.find((m) => Number(m.value) === result.actions.length);
    expect(sectionCountMetric).toBeDefined();
    expect(actionCountMetric).toBeDefined();
  });
});

describe("sensitive input boundary", () => {
  beforeEach(() => {
    generateMilitaryAIJson.mockReset();
  });

  it("blocks detected non-catalog input before Gemini transmission", async () => {
    await expect(generatePublicDemoResult({
      service: "militaryAi",
      tool: "securityScan",
      sourceText: "실제 좌표 37.12345, 127.12345",
    })).rejects.toThrow("외부 AI로 전송하지 않습니다");
    expect(generateMilitaryAIJson).not.toHaveBeenCalled();
  });
});

describe("honest fallback rules for catalog document tools", () => {
  beforeEach(() => {
    generateMilitaryAIJson.mockReset();
  });

  it("does not attribute malformed provider JSON to Gemini and throws a generation error with no matching example", async () => {
    generateMilitaryAIJson.mockResolvedValue({
      generated: { title: "결과 없음" },
      securityFlags: [],
      model: "gemini-2.5-flash",
    });

    await expect(
      generatePublicDemoResult({ service: "adminDoc", mode: "report", sourceText: "임의의 새 입력" }),
    ).rejects.toThrow();
  });

  it("returns the curated baseline only when exampleId is given and sourceText exactly matches the catalog entry", async () => {
    const example = exampleById("admin-joint-inspection")!;
    generateMilitaryAIJson.mockImplementation(async () => {
      throw new Error("provider down");
    });

    const result = await generatePublicDemoResult({
      service: "adminDoc",
      mode: "report",
      sourceText: example.sourceText,
      exampleId: example.id,
    });

    expect(result.model).toBe("curated-sample-fallback");
    expect(result.title).toBe(example.baselineResult.title);
  });

  it("returns the curated security baseline fields instead of placeholder sections", async () => {
    const example = exampleById("security-contact-info-included")!;
    generateMilitaryAIJson.mockImplementation(async () => {
      throw new Error("provider down");
    });

    const result = await generatePublicDemoResult({
      service: "adminDoc",
      mode: "security",
      sourceText: example.sourceText,
      exampleId: example.id,
    });

    expect(result.sections).toEqual(example.baselineResult.sections);
    expect(result.workItems[0].owner).toBe(example.baselineResult.actions[0].owner);
  });

  it("throws a generation error instead of a static document when the edited example text no longer matches the catalog", async () => {
    const example = exampleById("admin-joint-inspection")!;
    generateMilitaryAIJson.mockImplementation(async () => {
      throw new Error("provider down");
    });

    await expect(
      generatePublicDemoResult({
        service: "adminDoc",
        mode: "report",
        sourceText: `${example.sourceText} 수정됨`,
        exampleId: example.id,
      }),
    ).rejects.toThrow();
  });

  it("throws when exampleId belongs to a different tool than the one resolved for this request", async () => {
    const example = exampleById("approval-spare-battery-purchase")!;
    generateMilitaryAIJson.mockImplementation(async () => {
      throw new Error("provider down");
    });

    await expect(
      generatePublicDemoResult({
        service: "adminDoc",
        mode: "report",
        sourceText: example.sourceText,
        exampleId: example.id,
      }),
    ).rejects.toThrow();
  });
});
