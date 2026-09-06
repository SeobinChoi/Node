"use client";

import { useMemo, useState } from "react";
import { PublicDemoHeader } from "@/components/project/PublicDemoHeader";
import { evaluateOpsRadar } from "@/lib/demo/evaluate-ops-radar";
import { OPS_RADAR_TODAY, freshOpsRadarScenario } from "@/lib/demo/ops-radar-scenario";
import type { DemoTask } from "@/lib/demo/ops-radar-types";
import { OpsRadarDetailPanel } from "./OpsRadarDetailPanel";
import { OpsRadarGraph } from "./OpsRadarGraph";
import { OpsRadarMetrics } from "./OpsRadarMetrics";
import { OpsRadarReport } from "./OpsRadarReport";
import { OpsRadarTaskTable } from "./OpsRadarTaskTable";

export function OpsRadarDemoClient() {
  const [tasks, setTasks] = useState<DemoTask[]>(freshOpsRadarScenario);
  const [evaluated, setEvaluated] = useState(false);
  const [baseline, setBaseline] = useState<ReturnType<typeof evaluateOpsRadar>>();
  const [selectedId, setSelectedId] = useState<string>();
  const result = useMemo(() => evaluateOpsRadar({ tasks, today: OPS_RADAR_TODAY }), [tasks]);
  const selectedTask = result.tasks.find((task) => task.id === selectedId);
  const selectedReason = result.bottlenecks.find((reason) => reason.taskId === selectedId);
  const runEvaluation = () => { setEvaluated(true); setBaseline((current) => current ?? result); setSelectedId(result.bottlenecks[0]?.taskId); };
  const canComplete = (id: string) => {
    if (!evaluated) return false;
    const task = result.tasks.find((candidate) => candidate.id === id);
    return Boolean(task && task.status !== "completed" && task.dependencies.every((dependencyId) => result.tasks.find((candidate) => candidate.id === dependencyId)?.status === "completed"));
  };
  const complete = (id: string) => {
    if (!canComplete(id)) return;
    const next = tasks.map((task) => task.id === id ? { ...task, state: "completed" as const } : task);
    const nextResult = evaluateOpsRadar({ tasks: next, today: OPS_RADAR_TODAY });
    setTasks(next);
    setEvaluated(true);
    setBaseline((current) => current ?? result);
    setSelectedId(nextResult.bottlenecks[0]?.taskId ?? id);
  };
  const reset = () => { setTasks(freshOpsRadarScenario()); setEvaluated(false); setBaseline(undefined); setSelectedId(undefined); };
  const visibleResult = evaluated ? result : undefined;
  return <div lang="ko" className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900"><PublicDemoHeader variant="opsRadar" title="작전 과업 병목관리" />
    <main className="mx-auto max-w-7xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
      <section className="rounded-lg border border-slate-300 bg-white p-4 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-sm font-semibold text-blue-800">업무 진행·병목 평가</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">작전 과업 병목관리</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">업무 선후행 관계를 기준으로 진행 가능 여부와 병목 원인을 확인하는 공개 시연 화면입니다.</p></div><button type="button" onClick={runEvaluation} className="shrink-0 rounded bg-blue-800 px-4 py-2.5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">시연 시작</button></div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3"><p className="rounded bg-slate-100 px-3 py-2">비식별 샘플 데이터</p><p className="rounded bg-slate-100 px-3 py-2">브라우저 규칙 기반 평가</p><p className="rounded bg-slate-100 px-3 py-2">운영 시스템 연동 전 시연판</p></div>
        <ol aria-label="4단계 시연 순서" className="mt-4 grid gap-2 text-sm sm:grid-cols-4"><li className="rounded border border-slate-200 p-2">① 샘플 확인</li><li className="rounded border border-slate-200 p-2">② 평가 실행</li><li className="rounded border border-slate-200 p-2">③ 병목 해소</li><li className="rounded border border-slate-200 p-2">④ 보고 요약</li></ol>
        <details className="mt-4 rounded border border-slate-200 p-3 text-sm"><summary className="cursor-pointer font-medium">1분 시연 방법</summary><p className="mt-2 text-slate-600">시연 시작 후 업무 평가를 실행하고, 점검표 제출 병목을 선택해 영향 업무를 확인합니다. 완료 처리를 누르면 지연과 고위험 수치가 변하고, 마지막으로 보고문을 복사하거나 CSV를 내려받습니다.</p></details>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`rounded px-3 py-1.5 text-sm font-medium ${evaluated ? "bg-blue-100 text-blue-900" : "bg-slate-200 text-slate-700"}`}>{evaluated ? "평가 완료 · 규칙 기반 평가" : "평가 전"}</span><span className="text-xs text-slate-600">브라우저 내 시연 상태 · 새로고침하면 초기화</span></div><div className="flex gap-2"><button type="button" onClick={runEvaluation} className="rounded bg-blue-800 px-3 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">업무 평가 실행</button><button type="button" onClick={reset} className="rounded border border-slate-400 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">시연 초기화</button></div></section>
      <OpsRadarMetrics result={visibleResult} baseline={baseline} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><OpsRadarGraph result={result} evaluated={evaluated} onSelect={setSelectedId} /><OpsRadarDetailPanel evaluated={evaluated} task={selectedTask} reason={selectedReason} /></div>
      <section className="rounded-lg border border-slate-200 bg-white p-4"><h2 className="font-semibold">준비된 조치</h2><p className="mt-1 text-sm text-slate-600">상태를 바꾸면 같은 규칙으로 즉시 다시 평가합니다.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!canComplete("checklist")} onClick={() => complete("checklist")} className="rounded border border-blue-700 px-3 py-2 text-sm text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-500">점검표 제출 완료 처리</button><button type="button" disabled={!canComplete("approval")} onClick={() => complete("approval")} className="rounded border border-blue-700 px-3 py-2 text-sm text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-500">안전 통제 승인 처리</button></div></section>
      <OpsRadarTaskTable tasks={result.tasks} evaluated={evaluated} onSelect={setSelectedId} />
      {evaluated ? <OpsRadarReport result={result} /> : null}
    </main></div>;
}
