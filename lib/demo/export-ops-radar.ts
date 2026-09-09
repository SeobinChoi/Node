import type { DemoTask, EvaluationResult } from "@/lib/demo/ops-radar-types";

export type OpsRadarDocumentType = "command" | "action" | "weekly";

export const OPS_RADAR_DOCUMENT_TYPES: Array<{ id: OpsRadarDocumentType; label: string; hint: string }> = [
  { id: "command", label: "지휘관 상황보고", hint: "현재 상황과 병목을 지휘 계통에 보고하는 문안" },
  { id: "action", label: "병목 조치계획", hint: "병목 해소를 위한 담당·기한 중심 조치계획" },
  { id: "weekly", label: "주간 진행보고", hint: "완료·진행·위험 항목을 정리한 주간 보고" },
];

export const opsRadarDocumentLabel = (documentType: OpsRadarDocumentType): string =>
  OPS_RADAR_DOCUMENT_TYPES.find((item) => item.id === documentType)?.label ?? OPS_RADAR_DOCUMENT_TYPES[0].label;

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

const MAX_SOURCE_TASKS = 16;
const MAX_SOURCE_LENGTH = 6000;
const trim = (value: string, limit = 60) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
};

/** Serializes the operator's edited task graph into a bounded, non-sensitive prompt source. */
export function buildOpsRadarAiSource({
  scenarioTitle,
  documentType,
  tasks,
  result,
}: {
  scenarioTitle: string;
  documentType: OpsRadarDocumentType;
  tasks: DemoTask[];
  result: EvaluationResult;
}): string {
  const evaluatedById = new Map(result.tasks.map((task) => [task.id, task]));
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const dependencyNames = (dependencies: string[]) =>
    dependencies.map((id) => trim(titles.get(id) ?? id, 30)).join(" / ") || "없음";
  const report = buildOpsRadarReport(result);

  const taskLines = tasks.slice(0, MAX_SOURCE_TASKS).map((task) => {
    const evaluated = evaluatedById.get(task.id);
    return `- ${trim(task.title)} | 담당 ${trim(task.owner, 30)} | 기한 ${trim(task.dueDate, 12)} | 위험도 ${task.risk} | 입력상태 ${task.state} | 평가상태 ${statusLabel[evaluated?.status ?? "error"]} | 선행 ${dependencyNames(task.dependencies)} | 영향 ${evaluated?.downstreamIds.length ?? 0}건`;
  });
  const bottleneckLines = result.bottlenecks.slice(0, MAX_SOURCE_TASKS).map((bottleneck) =>
    `- ${trim(titles.get(bottleneck.taskId) ?? bottleneck.taskId)} | 사유 ${trim(bottleneck.reason, 80)} | 영향 ${bottleneck.impactCount}건`,
  );
  const recommendationLines = report.actions.slice(0, MAX_SOURCE_TASKS).map((action) =>
    `- ${trim(action.task)} | 담당 ${trim(action.owner, 30)} | 기한 ${trim(action.dueDate, 12)} | 조치 ${trim(action.action, 80)}`,
  );

  const source = [
    "[공개 시연 · 비식별 합성 데이터]",
    `documentType: ${documentType} (${opsRadarDocumentLabel(documentType)})`,
    `scenario: ${trim(scenarioTitle, 60)}`,
    `metrics: 고위험 ${result.metrics.highRisk}건 / 지연 ${result.metrics.delayed}건 / 보고가능 ${result.metrics.reportReady}건`,
    `tasks (${tasks.length}건):`,
    ...taskLines,
    `bottlenecks (${result.bottlenecks.length}건):`,
    ...(bottleneckLines.length > 0 ? bottleneckLines : ["- 없음"]),
    "recommendations:",
    ...(recommendationLines.length > 0 ? recommendationLines : ["- 즉시 조치가 필요한 병목 없음"]),
    `summary: ${trim(report.summary, 300)}`,
  ].join("\n");

  return source.length > MAX_SOURCE_LENGTH ? source.slice(0, MAX_SOURCE_LENGTH) : source;
}

export { statusLabel };
