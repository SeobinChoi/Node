import { describe, expect, it } from "vitest";
import { evaluateOpsRadar } from "@/lib/demo/evaluate-ops-radar";
import { buildOpsRadarAiSource } from "@/lib/demo/export-ops-radar";
import { buildOpsRadarActionQueue, dependencyOptions, removeOpsRadarTask } from "@/lib/demo/ops-radar-actions";
import { OPS_RADAR_SCENARIOS, freshOpsRadarScenario } from "@/lib/demo/ops-radar-scenario";
import { parseOpsRadarSnapshot, serializeOpsRadarSnapshot } from "@/lib/demo/ops-radar-snapshot";

describe("interactive Ops Radar", () => {
  it("ships four materially different editable scenarios", () => {
    expect(OPS_RADAR_SCENARIOS).toHaveLength(4);
    expect(new Set(OPS_RADAR_SCENARIOS.map((scenario) => scenario.tasks.length)).size).toBeGreaterThan(1);
    expect(new Set(OPS_RADAR_SCENARIOS.map((scenario) => scenario.tasks.flatMap((task) => task.dependencies).join(","))).size).toBe(4);

    const first = freshOpsRadarScenario(OPS_RADAR_SCENARIOS[0].id);
    first[0].title = "수정됨";
    expect(freshOpsRadarScenario(OPS_RADAR_SCENARIOS[0].id)[0].title).not.toBe("수정됨");
  });

  it("serializes the current edited task graph and evaluation for AI reporting", () => {
    const tasks = freshOpsRadarScenario("night-comms");
    tasks[0] = { ...tasks[0], title: "현장 수정 과업", owner: "수정 담당반" };
    const result = evaluateOpsRadar({ tasks, today: "2026-09-06" });
    const source = buildOpsRadarAiSource({ scenarioTitle: "야간 통신 점검", documentType: "command", tasks, result });

    expect(source).toContain("현장 수정 과업");
    expect(source).toContain("수정 담당반");
    expect(source).toContain("지휘관 상황보고");
    expect(source).toContain("bottlenecks");
  });

  it("derives the action queue from the evaluated tasks and moves to the next bottleneck", () => {
    const tasks = freshOpsRadarScenario("night-comms");
    const queue = buildOpsRadarActionQueue(evaluateOpsRadar({ tasks, today: "2026-09-06" }));

    expect(queue[0]).toMatchObject({ taskId: "checklist", isBottleneck: true, canComplete: true });
    expect(queue.map((item) => item.taskId)).toContain("approval");
    expect(queue.find((item) => item.taskId === "approval")?.canComplete).toBe(false);
    expect(queue.some((item) => item.taskId === "archive")).toBe(false);

    const completed = tasks.map((task) => task.id === "checklist" ? { ...task, state: "completed" as const } : task);
    const nextQueue = buildOpsRadarActionQueue(evaluateOpsRadar({ tasks: completed, today: "2026-09-06" }));
    expect(nextQueue[0]).toMatchObject({ taskId: "approval", isBottleneck: true, canComplete: true });
  });

  it("offers dependency options from the current scenario without self-reference", () => {
    const tasks = freshOpsRadarScenario("weather-response");
    const options = dependencyOptions(tasks, "patrol");

    expect(options.some((option) => option.id === "patrol")).toBe(false);
    expect(options.map((option) => option.id)).toEqual(["forecast", "drainage", "sandbag", "evacuation"]);
    expect(dependencyOptions(tasks, "unknown-task")).toHaveLength(tasks.length);
  });

  it("prevents dependency cycles and removes deleted task references", () => {
    const tasks = freshOpsRadarScenario("night-comms");

    expect(dependencyOptions(tasks, "checklist").map((option) => option.id)).not.toContain("approval");
    expect(dependencyOptions(tasks, "checklist").map((option) => option.id)).toContain("vehicle");

    const remaining = removeOpsRadarTask(tasks, "checklist");
    expect(remaining.some((task) => task.id === "checklist")).toBe(false);
    expect(remaining.every((task) => !task.dependencies.includes("checklist"))).toBe(true);
  });

  it("round-trips valid saved scenarios and rejects broken relationships", () => {
    const tasks = freshOpsRadarScenario("equipment-return");
    const saved = serializeOpsRadarSnapshot({ scenarioId: "equipment-return", scenarioTitle: "장비 반납 정비", tasks });
    expect(parseOpsRadarSnapshot(saved)).toEqual({ scenarioId: "equipment-return", scenarioTitle: "장비 반납 정비", tasks });

    expect(() => parseOpsRadarSnapshot(JSON.stringify({
      scenarioId: "bad",
      scenarioTitle: "잘못된 저장본",
      tasks: [{ ...tasks[0], dependencies: ["missing"] }],
    }))).toThrow();
    expect(() => parseOpsRadarSnapshot(JSON.stringify({
      scenarioId: "equipment-return",
      scenarioTitle: "잘못된 날짜",
      tasks: [{ ...tasks[0], dueDate: "2026-99-99", dependencies: [] }],
    }))).toThrow();
    expect(() => parseOpsRadarSnapshot(JSON.stringify({
      scenarioId: "equipment-return",
      scenarioTitle: "중복 관계",
      tasks: [
        { ...tasks[0], dependencies: [tasks[1].id, tasks[1].id] },
        { ...tasks[1], dependencies: [] },
      ],
    }))).toThrow();
  });
});
