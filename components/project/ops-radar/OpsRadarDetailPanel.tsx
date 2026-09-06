import type { BottleneckReason, EvaluatedTask } from "@/lib/demo/ops-radar-types";
import { statusLabel } from "@/lib/demo/export-ops-radar";

export function OpsRadarDetailPanel({ evaluated, task, reason }: { evaluated: boolean; task?: EvaluatedTask; reason?: BottleneckReason }) {
  return <aside data-testid="ops-radar-detail" aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-4">
    <h2 className="font-semibold text-slate-900">병목 상세</h2>
    {!evaluated ? <p className="mt-2 text-sm text-slate-600">업무 평가 후 원인과 조치 방법을 확인할 수 있습니다.</p> : !task ? <p className="mt-2 text-sm text-slate-600">그래프 또는 업무명을 선택하면 원인과 조치 방법을 확인할 수 있습니다.</p> : <div className="mt-3 space-y-3 text-sm">
      <div><p className="font-medium text-slate-900">{task.title}</p><p className="text-slate-600">{task.owner} · {statusLabel[task.status]} · 기한 {task.dueDate}</p></div>
      <div><p className="font-medium text-slate-800">막힌 이유</p><p className="text-slate-600">{reason?.reason ?? "현재 평가상 직접 병목으로 분류되지 않았습니다."}</p></div>
      <div><p className="font-medium text-slate-800">영향 업무</p><p className="text-slate-600">후속 {task.downstreamIds.length}건에 영향을 줍니다.</p></div>
      <div><p className="font-medium text-slate-800">권장 조치</p><p className="text-slate-600">{reason?.recommendedAction ?? "업무 진행 상태를 확인하세요."}</p></div>
    </div>}
  </aside>;
}
