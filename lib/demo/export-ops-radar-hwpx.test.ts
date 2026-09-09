import { describe, expect, it } from "vitest";
import { buildOpsRadarHwpx } from "@/lib/demo/export-ops-radar-hwpx";

describe("Ops Radar HWPX export", () => {
  it("creates an openable HWPX containing the generated Korean report", async () => {
    const bytes = await buildOpsRadarHwpx("지휘관 상황보고", "현재 병목은 점검표 제출입니다.\n\n- 운영반 확인");
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const { HwpxReader } = await import("hwp-convert");
    const reader = new HwpxReader();
    await reader.loadFromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(await reader.extractText()).toContain("현재 병목은 점검표 제출입니다.");
  });
});
