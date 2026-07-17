import { NodeDTO } from "@/types";

// ProjectListView와 브리핑 뷰가 공유하는 기한 계산 유틸.
// (ProjectListView에 있던 구현을 그대로 옮김 — 동작 변경 없음)

export function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 기한 초과 여부 (완료가 아니면서 마감일이 오늘보다 이전)
export function getOverdueDays(node: NodeDTO, todayMs: number): number | null {
  if (!node.dueAt || node.computedStatus === "DONE") return null;
  const due = new Date(node.dueAt);
  due.setHours(0, 0, 0, 0);
  const diff = todayMs - due.getTime();
  if (diff <= 0) return null;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
