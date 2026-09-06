import { describe, expect, it } from "vitest";
import { buildOpsRadarCsv, buildOpsRadarReport } from "@/lib/demo/export-ops-radar";
import { evaluateOpsRadar } from "@/lib/demo/evaluate-ops-radar";
import { OPS_RADAR_TODAY, freshOpsRadarScenario } from "@/lib/demo/ops-radar-scenario";

describe("Ops Radar exports", () => {
  it("creates a report and CSV with one row per evaluated sample task", () => {
    const result = evaluateOpsRadar({ tasks: freshOpsRadarScenario(), today: OPS_RADAR_TODAY });
    const report = buildOpsRadarReport(result);
    const csv = buildOpsRadarCsv(result);

    expect(report.summary).toContain("현재 병목");
    expect(report.actions.length).toBeGreaterThan(0);
    expect(csv.split("\n")).toHaveLength(result.tasks.length + 1);
    expect(csv.split("\n")[0]).toBe("업무명,담당 부서,평가 상태,기한,위험도,선행 업무,영향 업무 수");
  });
});
