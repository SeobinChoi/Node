import { describe, expect, it } from "vitest";
import { evaluateOpsRadar } from "@/lib/demo/evaluate-ops-radar";

describe("evaluateOpsRadar", () => {
  it("evaluates dependencies, approval waits, overdue work, bottleneck impact, and cycles", () => {
    const result = evaluateOpsRadar({
      today: "2026-09-06",
      tasks: [
        { id: "checklist", title: "점검표 제출", owner: "운영반", dueDate: "2026-09-05", risk: "high", state: "open", dependencies: [] },
        { id: "approval", title: "안전 통제 승인", owner: "안전반", dueDate: "2026-09-08", risk: "high", state: "approval_pending", dependencies: [] },
        { id: "night", title: "야간 통신 점검", owner: "통신반", dueDate: "2026-09-09", risk: "medium", state: "open", dependencies: ["checklist", "approval"] },
        { id: "report", title: "주간 상황보고", owner: "상황반", dueDate: "2026-09-10", risk: "medium", state: "open", dependencies: ["night"] },
        { id: "done", title: "완료 업무", owner: "상황반", dueDate: "2026-09-01", risk: "low", state: "completed", dependencies: [] },
        { id: "cycle-a", title: "순환 A", owner: "기획반", dueDate: "2026-09-09", risk: "low", state: "open", dependencies: ["cycle-b"] },
        { id: "cycle-b", title: "순환 B", owner: "기획반", dueDate: "2026-09-09", risk: "low", state: "open", dependencies: ["cycle-a"] },
      ],
    });

    expect(result.tasks.find((task) => task.id === "checklist")?.status).toBe("delayed");
    expect(result.tasks.find((task) => task.id === "approval")?.status).toBe("approval_wait");
    expect(result.tasks.find((task) => task.id === "night")?.status).toBe("blocked");
    expect(result.tasks.find((task) => task.id === "done")?.status).toBe("completed");
    expect(result.tasks.find((task) => task.id === "cycle-a")?.status).toBe("error");
    expect(result.bottlenecks.find((reason) => reason.taskId === "checklist")?.impactCount).toBe(2);
    expect(result.bottlenecks.find((reason) => reason.taskId === "checklist")?.recommendedAction).toContain("지연 원인");
  });

  it("treats an unfinished prerequisite as the root cause before pending approval", () => {
    const tasks = [
      { id: "source", title: "자료 제출", owner: "운영반", dueDate: "2026-09-05", risk: "high" as const, state: "open" as const, dependencies: [] },
      { id: "approval", title: "승인", owner: "안전반", dueDate: "2026-09-08", risk: "high" as const, state: "approval_pending" as const, dependencies: ["source"] },
      { id: "work", title: "후속 업무", owner: "통신반", dueDate: "2026-09-09", risk: "medium" as const, state: "open" as const, dependencies: ["approval"] },
    ];

    const before = evaluateOpsRadar({ tasks, today: "2026-09-06" });
    expect(before.tasks.find((task) => task.id === "approval")?.status).toBe("blocked");
    expect(before.bottlenecks.map((reason) => reason.taskId)).toEqual(["source"]);

    const after = evaluateOpsRadar({
      today: "2026-09-06",
      tasks: tasks.map((task) => task.id === "source" ? { ...task, state: "completed" as const } : task),
    });
    expect(after.tasks.find((task) => task.id === "approval")?.status).toBe("approval_wait");
    expect(after.bottlenecks.map((reason) => reason.taskId)).toEqual(["approval"]);
  });
});
