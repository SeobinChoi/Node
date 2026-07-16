"use client";

import { useMemo, type ReactNode } from "react";
import { CheckCircle2, PlayCircle, Clock, AlertTriangle, PauseCircle } from "lucide-react";
import { NodeDTO, ComputedStatus } from "@/types";

interface ProjectListViewProps {
  nodes: NodeDTO[];
  onSelectNode?: (nodeId: string) => void;
}

// 상태 표시 메타 (한국 행정 데모용 라벨)
const STATUS_META: Record<
  ComputedStatus,
  { label: string; className: string; icon: ReactNode }
> = {
  DONE: {
    label: "완료",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  DOING: {
    label: "진행",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <PlayCircle className="w-3.5 h-3.5" />,
  },
  BLOCKED: {
    label: "막힘",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  WAITING: {
    label: "대기",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <PauseCircle className="w-3.5 h-3.5" />,
  },
  TODO: {
    label: "예정",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

// 기한 초과 여부 (완료가 아니면서 마감일이 오늘보다 이전)
function getOverdueDays(node: NodeDTO, todayMs: number): number | null {
  if (!node.dueAt || node.computedStatus === "DONE") return null;
  const due = new Date(node.dueAt);
  due.setHours(0, 0, 0, 0);
  const diff = todayMs - due.getTime();
  if (diff <= 0) return null;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

interface Section {
  key: string;
  title: string;
  rows: NodeDTO[];
}

export function ProjectListView({ nodes, onSelectNode }: ProjectListViewProps) {
  const todayMs = startOfToday();

  // 세부과제(상위 노드)별로 묶기
  const sections = useMemo<Section[]>(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const childrenOf = new Map<string, NodeDTO[]>();
    for (const n of nodes) {
      if (n.parentNodeId) {
        const arr = childrenOf.get(n.parentNodeId) ?? [];
        arr.push(n);
        childrenOf.set(n.parentNodeId, arr);
      }
    }

    // 노드의 모든 하위(재귀) 수집
    const collectDescendants = (id: string): NodeDTO[] => {
      const direct = childrenOf.get(id) ?? [];
      return direct.flatMap((c) => [c, ...collectDescendants(c.id)]);
    };

    const topLevel = nodes.filter((n) => !n.parentNodeId || !byId.has(n.parentNodeId));
    const result: Section[] = [];
    const standalone: NodeDTO[] = [];

    for (const node of topLevel) {
      const descendants = collectDescendants(node.id);
      if (descendants.length > 0) {
        result.push({ key: node.id, title: node.title, rows: descendants });
      } else {
        standalone.push(node);
      }
    }

    if (standalone.length > 0) {
      result.push({ key: "__standalone__", title: "독립 업무", rows: standalone });
    }

    // 각 섹션 내부 정렬: 마감 빠른 순 → 제목순
    for (const s of result) {
      s.rows.sort((a, b) => {
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return a.title.localeCompare(b.title);
      });
    }

    return result;
  }, [nodes]);

  // 진척 요약 (전체 노드 기준)
  const summary = useMemo(() => {
    let done = 0;
    let doing = 0;
    let blocked = 0;
    let overdue = 0;
    for (const n of nodes) {
      if (n.computedStatus === "DONE") done++;
      else if (n.computedStatus === "DOING") doing++;
      else if (n.computedStatus === "BLOCKED") blocked++;
      if (getOverdueDays(n, todayMs) !== null) overdue++;
    }
    const total = nodes.length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, blocked, overdue, rate };
  }, [nodes, todayMs]);

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        아직 등록된 업무가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* 진척 요약 */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">사업 진척 현황</h2>
            <span className="text-sm text-slate-500">
              완료율 <span className="font-bold text-slate-900">{summary.rate}%</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${summary.rate}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryStat label="전체" value={summary.total} className="text-slate-900" />
            <SummaryStat label="완료" value={summary.done} className="text-emerald-600" />
            <SummaryStat label="진행" value={summary.doing} className="text-blue-600" />
            <SummaryStat label="막힘" value={summary.blocked} className="text-red-600" />
            <SummaryStat label="지연" value={summary.overdue} className="text-orange-600" />
          </div>
        </div>

        {/* 세부과제별 표 */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.key}
              className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
                <span className="text-xs text-slate-400">{section.rows.length}개 업무</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="px-5 py-2 font-medium">업무명</th>
                      <th className="px-3 py-2 font-medium">담당자</th>
                      <th className="px-3 py-2 font-medium">기한</th>
                      <th className="px-3 py-2 font-medium">상태</th>
                      <th className="px-3 py-2 font-medium">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((node) => {
                      const overdueDays = getOverdueDays(node, todayMs);
                      const status = STATUS_META[node.computedStatus];
                      const ownerNames =
                        node.owners && node.owners.length > 0
                          ? node.owners.map((o) => o.name).join(", ")
                          : "-";
                      return (
                        <tr
                          key={node.id}
                          onClick={() => onSelectNode?.(node.id)}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 cursor-pointer"
                        >
                          <td className="px-5 py-2.5 text-slate-800">{node.title}</td>
                          <td className="px-3 py-2.5 text-slate-600">{ownerNames}</td>
                          <td
                            className={`px-3 py-2.5 ${
                              overdueDays !== null ? "text-red-600 font-medium" : "text-slate-600"
                            }`}
                          >
                            {formatDate(node.dueAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
                            >
                              {status.icon}
                              {status.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {node.computedStatus === "BLOCKED" ? (
                              <span className="text-xs text-red-600">
                                {node.waitingReason || "선행 업무 미완료"}
                              </span>
                            ) : overdueDays !== null ? (
                              <span className="text-xs text-orange-600">지연 {overdueDays}일</span>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
      <div className={`text-2xl font-bold ${className ?? "text-slate-900"}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
