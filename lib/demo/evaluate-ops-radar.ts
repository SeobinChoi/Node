import type { BottleneckReason, DemoTask, EvaluationResult, EvaluatedTask, TaskStatus } from "@/lib/demo/ops-radar-types";

export function evaluateOpsRadar({ tasks, today }: { tasks: DemoTask[]; today: string }): EvaluationResult {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const statuses = new Map<string, TaskStatus>();
  const visiting = new Set<string>();

  const evaluate = (id: string): TaskStatus => {
    const known = statuses.get(id);
    if (known) return known;
    const task = byId.get(id);
    if (!task) return "error";
    if (visiting.has(id)) return "error";
    visiting.add(id);
    const dependencyStatuses = task.dependencies.map(evaluate);
    visiting.delete(id);

    let status: TaskStatus;
    if (dependencyStatuses.includes("error")) status = "error";
    else if (task.state === "completed") status = "completed";
    else if (task.dueDate < today) status = "delayed";
    else if (dependencyStatuses.some((dependency) => dependency !== "completed")) status = "blocked";
    else if (task.state === "approval_pending") status = "approval_wait";
    else status = "ready";
    statuses.set(id, status);
    return status;
  };

  const downstreamFor = (taskId: string) => {
    const downstream = new Set<string>();
    const visit = (id: string) => {
      for (const task of tasks) {
        if (task.dependencies.includes(id) && !downstream.has(task.id)) {
          downstream.add(task.id);
          visit(task.id);
        }
      }
    };
    visit(taskId);
    return [...downstream];
  };

  const evaluated: EvaluatedTask[] = tasks.map((task) => ({
    ...task,
    status: evaluate(task.id),
    downstreamIds: downstreamFor(task.id),
  }));
  const bottlenecks: BottleneckReason[] = evaluated
    .filter((task) => task.status === "delayed" || task.status === "approval_wait")
    .filter((task) => task.downstreamIds.length > 0)
    .map((task) => ({
      taskId: task.id,
      impactCount: task.downstreamIds.length,
      reason: task.status === "delayed" ? "기한이 경과했지만 완료되지 않았습니다." : task.status === "approval_wait" ? "승인 처리가 완료되지 않았습니다." : "선행 업무가 완료되지 않았습니다.",
      recommendedAction: task.status === "approval_wait"
        ? "담당 부서에서 승인 처리를 완료하세요."
        : task.dependencies.length > 0
          ? "담당 부서에서 선행 업무 상태와 지연 원인을 확인하세요."
          : "담당 부서에서 완료 여부와 지연 원인을 확인하고 조치하세요.",
    }));

  return {
    tasks: evaluated,
    bottlenecks,
    metrics: {
      highRisk: evaluated.filter((task) => task.risk === "high" && task.status !== "completed").length,
      delayed: evaluated.filter((task) => task.status === "delayed").length,
      reportReady: evaluated.filter((task) => task.status === "ready" || task.status === "completed").length,
    },
  };
}
