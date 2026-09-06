import type { DemoTask } from "@/lib/demo/ops-radar-types";

export const OPS_RADAR_TODAY = "2026-09-06";

export const opsRadarScenario: DemoTask[] = [
  { id: "checklist", title: "점검표 제출", owner: "운영반", dueDate: "2026-09-05", risk: "high", state: "open", dependencies: [] },
  { id: "approval", title: "안전 통제 승인", owner: "안전반", dueDate: "2026-09-08", risk: "high", state: "approval_pending", dependencies: ["checklist"] },
  { id: "night", title: "야간 통신 점검", owner: "통신반", dueDate: "2026-09-09", risk: "high", state: "open", dependencies: ["approval"] },
  { id: "report", title: "주간 상황보고", owner: "상황반", dueDate: "2026-09-10", risk: "medium", state: "open", dependencies: ["night"] },
  { id: "vehicle", title: "장비 점검 결과 확인", owner: "군수반", dueDate: "2026-09-09", risk: "medium", state: "open", dependencies: [] },
  { id: "briefing", title: "지휘관 브리핑 자료", owner: "기획반", dueDate: "2026-09-11", risk: "medium", state: "open", dependencies: ["report", "vehicle"] },
  { id: "archive", title: "전일 조치기록 정리", owner: "상황반", dueDate: "2026-09-05", risk: "low", state: "completed", dependencies: [] },
];

export function freshOpsRadarScenario(): DemoTask[] {
  return opsRadarScenario.map((task) => ({ ...task, dependencies: [...task.dependencies] }));
}
