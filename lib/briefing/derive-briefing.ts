import { GraphData, NodeDTO } from "@/types";
import { getOverdueDays, startOfDay } from "@/lib/utils/overdue";

// 브리핑 뷰의 규칙 기반 요약 엔진.
// 서버가 이미 계산한 computedStatus/blocksCount와 DEPENDS_ON 엣지만으로
// "지금 무엇을, 왜"를 결정론적으로 도출한다 — LLM 없음.

export type ActionCategory = "OVERDUE" | "BLOCKED" | "WAITING" | "DO_NOW";

export interface ActionItem {
  node: NodeDTO;
  category: ActionCategory;
  reasonKo: string;
  ownerLabel: string;
  actionLabel: string;
  /** 행 클릭 시 보드에서 포커스할 노드. 막힘이면 실제로 손댈 수 있는 선행 업무. */
  focusNodeId: string;
  overdueDays?: number;
}

export interface RootCause {
  node: NodeDTO;
  /** 이 노드를 거슬러 올라오는 막힌 노드 수 */
  blockedDownstreamCount: number;
}

export interface CriticalDeadline {
  node: NodeDTO;
  /** 음수 = 초과, 0 = 오늘, 양수 = 남은 일수 */
  daysUntil: number;
  overdue: boolean;
}

export interface BriefingCounts {
  total: number;
  done: number;
  doing: number;
  blocked: number;
  waiting: number;
  overdue: number;
  rate: number;
}

export interface SituationSummary {
  nearestDeadline: CriticalDeadline | null;
  /** 다른 막힌 노드가 의존 중인 노드 수 (blocksCount > 0) */
  blockedGateCount: number;
  rootCauses: RootCause[];
  counts: BriefingCounts;
  headlineKo: string;
}

export interface BriefingModel {
  isEmpty: boolean;
  situation: SituationSummary;
  queue: ActionItem[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

const isIncomplete = (n: NodeDTO) => n.computedStatus !== "DONE";

function ownerLabelOf(node: NodeDTO): string {
  const names = node.owners?.map((o) => o.name).filter(Boolean) ?? [];
  if (names.length > 0) return names.join(", ");
  return node.ownerName || "미지정";
}

/** waitingReason(영문)의 최후 폴백 번역 — 구조 기반 도출이 실패할 때만 사용 */
export function fallbackReasonKo(waitingReason: string | undefined): string | null {
  if (!waitingReason) return null;
  if (waitingReason === "Waiting for response") return "응답 대기";
  if (waitingReason === "Waiting for approval") return "승인 대기";
  const m = /^Blocked by (\d+) tasks?$/.exec(waitingReason);
  if (m) return `선행 ${m[1]}건 미완료`;
  return null;
}

export function deriveBriefing(data: GraphData, nowMs: number): BriefingModel {
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const todayMs = startOfDay(nowMs);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // DEPENDS_ON 인접 리스트 (양 끝점이 모두 존재하는 엣지만)
  const prereqsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.relation !== "DEPENDS_ON") continue;
    if (!byId.has(e.fromNodeId) || !byId.has(e.toNodeId)) continue;
    const arr = prereqsOf.get(e.fromNodeId) ?? [];
    arr.push(e.toNodeId);
    prereqsOf.set(e.fromNodeId, arr);
  }

  const incompletePrereqs = (id: string): NodeDTO[] =>
    (prereqsOf.get(id) ?? [])
      .map((pid) => byId.get(pid))
      .filter((n): n is NodeDTO => !!n && isIncomplete(n));

  const hasApprovalEdge = (id: string): boolean =>
    edges.some((e) => e.fromNodeId === id && e.relation === "APPROVAL_BY" && byId.has(e.toNodeId));

  // ── 집계 ──────────────────────────────────────────────────────────────
  const counts: BriefingCounts = {
    total: nodes.length,
    done: 0,
    doing: 0,
    blocked: 0,
    waiting: 0,
    overdue: 0,
    rate: 0,
  };
  for (const n of nodes) {
    if (n.computedStatus === "DONE") counts.done++;
    else if (n.computedStatus === "DOING") counts.doing++;
    else if (n.computedStatus === "BLOCKED") counts.blocked++;
    else if (n.computedStatus === "WAITING") counts.waiting++;
    if (getOverdueDays(n, todayMs) !== null) counts.overdue++;
  }
  counts.rate = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  // ── 임박 마감 ──────────────────────────────────────────────────────────
  let nearestDeadline: CriticalDeadline | null = null;
  {
    const candidates = nodes.filter((n) => n.dueAt && isIncomplete(n));
    candidates.sort((a, b) => {
      const d = a.dueAt!.localeCompare(b.dueAt!);
      if (d !== 0) return d;
      const g = (b.blocksCount ?? 0) - (a.blocksCount ?? 0);
      if (g !== 0) return g;
      return a.title.localeCompare(b.title);
    });
    const pick = candidates[0];
    if (pick) {
      const daysUntil = Math.round((startOfDay(new Date(pick.dueAt!).getTime()) - todayMs) / DAY_MS);
      nearestDeadline = { node: pick, daysUntil, overdue: daysUntil < 0 };
    }
  }

  // ── 근본 원인 (cycle-safe 상향 탐색) ───────────────────────────────────
  const rootCounts = new Map<string, number>();
  for (const b of nodes) {
    if (b.computedStatus !== "BLOCKED") continue;
    const terminals = new Set<string>();
    const visited = new Set<string>();
    const stack = [b.id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const ups = incompletePrereqs(cur);
      if (ups.length === 0) {
        terminals.add(cur);
      } else {
        for (const up of ups) stack.push(up.id);
      }
    }
    for (const t of terminals) rootCounts.set(t, (rootCounts.get(t) ?? 0) + 1);
  }
  const rootCauses: RootCause[] = [...rootCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (byId.get(b[0])?.blocksCount ?? 0) - (byId.get(a[0])?.blocksCount ?? 0);
    })
    .slice(0, 3)
    .map(([id, count]) => ({ node: byId.get(id)!, blockedDownstreamCount: count }));

  const blockedGateCount = nodes.filter((n) => (n.blocksCount ?? 0) > 0).length;

  // ── 헤드라인 ──────────────────────────────────────────────────────────
  const headlineParts: string[] = [];
  if (nearestDeadline) {
    const t = nearestDeadline.node.title;
    headlineParts.push(
      nearestDeadline.overdue
        ? `${t}이(가) ${Math.abs(nearestDeadline.daysUntil)}일 지났습니다.`
        : nearestDeadline.daysUntil === 0
          ? `${t}이(가) 오늘 마감입니다.`
          : `${t}까지 D-${nearestDeadline.daysUntil}.`
    );
  }
  if (counts.blocked > 0) {
    headlineParts.push(`업무 ${counts.blocked}건이 막혀 있습니다.`);
    if (rootCauses.length > 0) {
      headlineParts.push(`원인은 ${rootCauses[0].node.title}(으)로 모입니다.`);
    }
  } else if (counts.total > 0) {
    headlineParts.push(
      counts.done === counts.total ? "모든 업무가 완료됐습니다." : "막힘 없이 진행 중입니다."
    );
  }
  const headlineKo = headlineParts.join(" ") || "등록된 업무가 없습니다.";

  // ── 액션 큐 ───────────────────────────────────────────────────────────
  const groups: Record<ActionCategory, ActionItem[]> = {
    OVERDUE: [],
    BLOCKED: [],
    WAITING: [],
    DO_NOW: [],
  };

  for (const n of nodes) {
    if (n.computedStatus === "DONE") continue;

    const overdueDays = getOverdueDays(n, todayMs);
    const ups = incompletePrereqs(n.id);
    const blockedByDeps = n.computedStatus === "BLOCKED" && ups.length > 0;

    let category: ActionCategory;
    if (overdueDays !== null) category = "OVERDUE";
    else if (n.computedStatus === "BLOCKED") category = "BLOCKED";
    else if (n.computedStatus === "WAITING") category = "WAITING";
    else category = "DO_NOW";

    let reasonKo: string;
    let actionLabel: string;
    if (category === "OVERDUE") {
      reasonKo = `기한 ${overdueDays}일 초과`;
      actionLabel = "지금 처리";
    } else if (blockedByDeps) {
      reasonKo = `선행 ${ups.length}건 미완료 · ${ups[0].title}`;
      actionLabel = "선행 업무 보기";
    } else if (n.computedStatus === "BLOCKED" || n.computedStatus === "WAITING") {
      if (n.waitingReason === "Waiting for response") {
        reasonKo = "응답 대기";
        actionLabel = "응답 확인";
      } else if (hasApprovalEdge(n.id) || n.waitingReason === "Waiting for approval") {
        reasonKo = "승인 대기";
        actionLabel = "승인 확인";
      } else {
        reasonKo = fallbackReasonKo(n.waitingReason) ?? "대기 중";
        actionLabel = "확인";
      }
    } else {
      reasonKo = n.computedStatus === "DOING" ? "진행 중" : "지금 시작 가능";
      actionLabel = "시작하기";
    }

    groups[category].push({
      node: n,
      category,
      reasonKo,
      ownerLabel: ownerLabelOf(n),
      actionLabel,
      focusNodeId: blockedByDeps ? ups[0].id : n.id,
      overdueDays: overdueDays ?? undefined,
    });
  }

  const byDue = (a: ActionItem, b: ActionItem) => {
    if (a.node.dueAt && b.node.dueAt) return a.node.dueAt.localeCompare(b.node.dueAt);
    if (a.node.dueAt) return -1;
    if (b.node.dueAt) return 1;
    return a.node.title.localeCompare(b.node.title);
  };
  groups.OVERDUE.sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  groups.BLOCKED.sort((a, b) => {
    const g = (b.node.blocksCount ?? 0) - (a.node.blocksCount ?? 0);
    if (g !== 0) return g;
    return byDue(a, b);
  });
  groups.WAITING.sort(byDue);
  groups.DO_NOW.sort(byDue);

  return {
    isEmpty: nodes.length === 0,
    situation: { nearestDeadline, blockedGateCount, rootCauses, counts, headlineKo },
    queue: [...groups.OVERDUE, ...groups.BLOCKED, ...groups.WAITING, ...groups.DO_NOW],
  };
}
