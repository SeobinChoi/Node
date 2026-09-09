import type { DemoTask, EvaluationResult, EvaluatedTask, TaskStatus } from "@/lib/demo/ops-radar-types";

export interface OpsRadarActionItem {
  taskId: string;
  title: string;
  owner: string;
  status: TaskStatus;
  impactCount: number;
  isBottleneck: boolean;
  canComplete: boolean;
  reason: string;
}

const statusReason: Record<TaskStatus, string> = {
  ready: "선행 업무가 모두 끝나 지금 완료 처리할 수 있습니다.",
  blocked: "선행 업무가 끝나야 진행할 수 있습니다.",
  approval_wait: "승인 처리가 남아 있습니다.",
  delayed: "기한이 경과했습니다.",
  completed: "이미 완료된 업무입니다.",
  error: "선후행 관계를 다시 확인해야 합니다.",
};

const isCompletable = (task: EvaluatedTask, byId: Map<string, EvaluatedTask>) =>
  task.status !== "completed" && task.dependencies.every((dependencyId) => byId.get(dependencyId)?.status === "completed");

/** Orders the current bottlenecks first, then the remaining open tasks by how much they hold up. */
export function buildOpsRadarActionQueue(result: EvaluationResult, limit = 4): OpsRadarActionItem[] {
  const byId = new Map(result.tasks.map((task) => [task.id, task]));
  const bottleneckById = new Map(result.bottlenecks.map((bottleneck) => [bottleneck.taskId, bottleneck]));
  const toItem = (task: EvaluatedTask): OpsRadarActionItem => ({
    taskId: task.id,
    title: task.title,
    owner: task.owner,
    status: task.status,
    impactCount: task.downstreamIds.length,
    isBottleneck: bottleneckById.has(task.id),
    canComplete: isCompletable(task, byId),
    reason: bottleneckById.get(task.id)?.reason ?? statusReason[task.status],
  });

  const open = result.tasks.filter((task) => task.status !== "completed");
  const bottlenecks = open
    .filter((task) => bottleneckById.has(task.id))
    .sort((a, b) => b.downstreamIds.length - a.downstreamIds.length);
  const rest = open
    .filter((task) => !bottleneckById.has(task.id))
    .sort((a, b) => b.downstreamIds.length - a.downstreamIds.length || a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));

  return [...bottlenecks, ...rest].slice(0, limit).map(toItem);
}

/** Dependency choices for the edited task: every other task in the current scenario. */
export function dependencyOptions(tasks: DemoTask[], taskId: string): Array<{ id: string; title: string }> {
  return tasks.filter((task) => task.id !== taskId).map((task) => ({ id: task.id, title: task.title }));
}
