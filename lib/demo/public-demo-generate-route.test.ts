import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/public-demo-service", () => ({
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

const validBody = JSON.stringify({ service: "militaryAi", sourceText: "safe demo text" });

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/demo/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("public demo generate request boundary", () => {
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
