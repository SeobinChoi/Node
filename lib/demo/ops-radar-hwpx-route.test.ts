import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/demo/hwpx/route";

const request = (body: unknown) => new NextRequest("http://localhost/api/demo/hwpx", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "route-test" },
  body: JSON.stringify(body),
});

describe("Ops Radar HWPX route validation", () => {
  it("rejects XML control characters", async () => {
    expect((await POST(request({ title: "보고서", text: "본문\u0000" }))).status).toBe(400);
  });

  it("rejects paragraph amplification payloads", async () => {
    expect((await POST(request({ title: "보고서", text: Array(201).fill("x").join("\n") }))).status).toBe(400);
  });

  it("rate-limits anonymous exports", async () => {
    let response: Response | undefined;
    for (let index = 0; index < 13; index += 1) {
      response = await POST(new NextRequest("http://localhost/api/demo/hwpx", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "hwpx-rate-limit" },
        body: JSON.stringify({ title: "보고서", text: "\u0000" }),
      }));
    }
    expect(response?.status).toBe(429);
  });
});