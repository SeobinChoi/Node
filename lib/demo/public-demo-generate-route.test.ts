import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/public-demo-service", () => ({
  PublicDemoSensitiveInputError: class extends Error {},
  normalizeDemoService: (service: string) => service,
  generatePublicDemoResult: vi.fn(async () => ({
    title: "demo",
    summary: "demo",
    sections: [],
    actions: [],
    security: [],
    metrics: [],
    workItems: [],
    markdown: "# demo",
    model: "gemini-test",
  })),
}));

import { POST } from "@/app/api/demo/generate/route";
import { generatePublicDemoResult, PublicDemoSensitiveInputError } from "@/lib/ai/public-demo-service";

const validBody = JSON.stringify({ service: "militaryAi", sourceText: "safe demo text" });

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/demo/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("public demo generate request boundary", () => {
  it("returns 400 without exposing detected sensitive input", async () => {
    vi.mocked(generatePublicDemoResult).mockRejectedValueOnce(
      new PublicDemoSensitiveInputError("실제 민감정보로 보이는 입력은 외부 AI로 전송하지 않습니다."),
    );
    const response = await POST(request(validBody, { "x-vercel-forwarded-for": "sensitive-test" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "실제 민감정보로 보이는 입력은 외부 AI로 전송하지 않습니다." });
  });

  it("rejects an oversized body even without content-length", async () => {
    const req = request(JSON.stringify({ service: "militaryAi", sourceText: "safe", ignored: "x".repeat(81_000) }), {
      "x-vercel-forwarded-for": "size-test",
    });
    expect(req.headers.get("content-length")).toBeNull();
    expect((await POST(req)).status).toBe(413);
  });

  it("does not let spoofed x-forwarded-for values bypass the trusted limiter", async () => {
    const responses = await Promise.all(Array.from({ length: 41 }, (_, index) => POST(request(validBody, {
      "x-vercel-forwarded-for": "rate-test",
      "x-forwarded-for": `198.51.100.${index}`,
    }))));
    expect(responses.slice(0, 40).every((response) => response.status === 200)).toBe(true);
    expect(responses[40].status).toBe(429);
  });
});
