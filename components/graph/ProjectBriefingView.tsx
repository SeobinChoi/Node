"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  GitBranch,
  LayoutTemplate,
  Loader2,
} from "lucide-react";
import { GraphData } from "@/types";
import { cn } from "@/lib/utils";
import { STATUS_VISUALS } from "@/lib/ui/node-visuals";
import {
  deriveBriefing,
  type ActionCategory,
  type ActionItem,
} from "@/lib/briefing/derive-briefing";

interface ProjectBriefingViewProps {
  data: GraphData;
  onSelectNode: (nodeId: string) => void;
  /** 온보딩 템플릿 적용용 (없으면 CTA 숨김) */
  projectId?: string;
  onDataChange?: () => void;
}

const GROUP_META: Record<ActionCategory, { title: string; accentClass: string }> = {
  OVERDUE: { title: "지연", accentClass: "text-red-600" },
  BLOCKED: { title: "막힘", accentClass: "text-red-600" },
  WAITING: { title: "대기", accentClass: "text-amber-600" },
  DO_NOW: { title: "지금", accentClass: "text-brand" },
};

export function ProjectBriefingView({
  data,
  onSelectNode,
  projectId,
  onDataChange,
}: ProjectBriefingViewProps) {
  const model = useMemo(() => deriveBriefing(data, Date.now()), [data]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const applyTemplate = async () => {
    if (!projectId || applyingTemplate) return;
    setApplyingTemplate(true);
    setTemplateError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/template`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "템플릿 적용에 실패했습니다");
      onDataChange?.();
    } catch (e) {
      setTemplateError(e instanceof Error ? e.message : "템플릿 적용에 실패했습니다");
    } finally {
      setApplyingTemplate(false);
    }
  };

  if (model.isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">아직 등록된 업무가 없습니다.</p>
        {projectId && (
          <>
            <button
              onClick={applyTemplate}
              disabled={applyingTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {applyingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LayoutTemplate className="h-4 w-4" />
              )}
              연차보고 준비 템플릿으로 시작
            </button>
            <p className="max-w-xs text-xs text-muted-foreground">
              사업계획 확정부터 최종 보고서 제출까지의 기본 업무 6건과 의존 관계가 만들어집니다.
              목록 탭에서 엑셀로 가져올 수도 있습니다.
            </p>
            {templateError && <p className="text-xs text-red-600">{templateError}</p>}
          </>
        )}
      </div>
    );
  }

  const { situation, queue } = model;
  const { nearestDeadline, counts } = situation;

  const grouped = queue.reduce<Partial<Record<ActionCategory, ActionItem[]>>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto bg-muted/30">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
        {/* 현재 상황 */}
        <section className="rounded-lg border border-brand/20 bg-brand-muted px-5 py-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
            현재 상황
          </div>
          <p className="text-[15px] font-medium leading-relaxed text-foreground">
            {situation.headlineKo}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {nearestDeadline && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium",
                  nearestDeadline.overdue
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-border bg-background text-foreground"
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {nearestDeadline.overdue
                  ? `${Math.abs(nearestDeadline.daysUntil)}일 초과`
                  : nearestDeadline.daysUntil === 0
                    ? "오늘 마감"
                    : `D-${nearestDeadline.daysUntil}`}
              </span>
            )}
            {situation.blockedGateCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                병목 {situation.blockedGateCount}곳
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 font-medium text-foreground">
              완료율 {counts.rate}%
              <span className="ml-1 text-muted-foreground">
                ({counts.done}/{counts.total})
              </span>
            </span>
          </div>
        </section>

        {/* 핵심 병목 */}
        {situation.rootCauses.length > 0 && (
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              핵심 병목
            </div>
            <div className="divide-y divide-border">
              {situation.rootCauses.map((rc) => (
                <button
                  key={rc.node.id}
                  onClick={() => onSelectNode(rc.node.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <GitBranch className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {rc.node.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    하위 {rc.blockedDownstreamCount}건 막힘
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 액션 큐 */}
        {(Object.keys(GROUP_META) as ActionCategory[]).map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          const meta = GROUP_META[cat];
          return (
            <section key={cat} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <span className={cn("text-[11px] font-semibold uppercase tracking-wider", meta.accentClass)}>
                  {meta.title}
                </span>
                <span className="text-[11px] text-muted-foreground">{items.length}건</span>
              </div>
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const sv = STATUS_VISUALS[item.node.computedStatus];
                  const StatusIcon = sv.icon;
                  return (
                    <div
                      key={item.node.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5",
                        item.category === "OVERDUE" && "bg-red-50/50"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          sv.badgeClass
                        )}
                      >
                        <StatusIcon className="h-2.5 w-2.5" />
                        {sv.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {item.node.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {item.ownerLabel} · {item.reasonKo}
                        </div>
                      </div>
                      <button
                        onClick={() => onSelectNode(item.focusNodeId)}
                        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-brand hover:text-brand"
                      >
                        {item.actionLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
