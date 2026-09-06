import type { EvaluationResult } from "@/lib/demo/ops-radar-types";

const statusLabel: Record<string, string> = {
  ready: "진행 가능",
  blocked: "선행업무 대기",
  approval_wait: "승인 대기",
  delayed: "지연",
  completed: "완료",
  error: "관계 오류",
};

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export function buildOpsRadarReport(result: EvaluationResult) {
  const bottleneck = result.bottlenecks[0];
  const task = bottleneck ? result.tasks.find((item) => item.id === bottleneck.taskId) : undefined;
  const summary = bottleneck && task
    ? `현재 병목은 ${task.title}입니다. ${bottleneck.reason} 이 업무는 ${bottleneck.impactCount}건의 후속 업무에 영향을 줍니다. ${bottleneck.recommendedAction}`
    : "현재 평가 기준에서 즉시 조치가 필요한 병목은 없습니다. 보고 가능 업무를 확인하세요.";
  const actions = result.bottlenecks.map((reason) => {
    const related = result.tasks.find((taskItem) => taskItem.id === reason.taskId);
    return { taskId: reason.taskId, task: related?.title ?? reason.taskId, owner: related?.owner ?? "담당 부서", dueDate: related?.dueDate ?? "-", action: reason.recommendedAction };
  });
  return { summary, actions };
}

export function buildOpsRadarCsv(result: EvaluationResult) {
  const header = "업무명,담당 부서,평가 상태,기한,위험도,선행 업무,영향 업무 수";
  const names = new Map(result.tasks.map((task) => [task.id, task.title]));
  const rows = result.tasks.map((task) => [
    task.title,
    task.owner,
    statusLabel[task.status],
    task.dueDate,
    task.risk,
    task.dependencies.map((dependency) => names.get(dependency) ?? dependency).join(" / ") || "없음",
    task.downstreamIds.length,
  ].map(csvCell).join(","));
  return [header, ...rows].join("\n");
}

export { statusLabel };
