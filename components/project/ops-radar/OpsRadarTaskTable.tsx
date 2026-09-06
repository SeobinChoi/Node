import type { EvaluatedTask } from "@/lib/demo/ops-radar-types";
import { statusLabel } from "@/lib/demo/export-ops-radar";

export function OpsRadarTaskTable({ tasks, evaluated, onSelect }: { tasks: EvaluatedTask[]; evaluated: boolean; onSelect: (id: string) => void }) {
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  return <section aria-labelledby="ops-task-list-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-4 py-3"><h2 id="ops-task-list-title" className="font-semibold text-slate-900">샘플 업무 현황</h2></div>
    <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-4 py-3">업무</th><th className="px-3 py-3">평가 상태</th><th className="px-3 py-3">담당</th><th className="px-3 py-3">기한</th><th className="px-3 py-3">선행 업무</th><th className="px-3 py-3">영향</th></tr></thead>
      <tbody>{tasks.map((task) => <tr key={task.id} data-testid={`ops-task-${task.id}`} className="border-t border-slate-100">
        <td className="px-4 py-3"><button type="button" onClick={() => onSelect(task.id)} className="text-left font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{task.title}</button></td>
        <td className="px-3 py-3">{evaluated ? statusLabel[task.status] : "평가 전"}</td><td className="px-3 py-3">{task.owner}</td><td className="px-3 py-3">{task.dueDate}</td><td className="px-3 py-3">{task.dependencies.map((id) => titles.get(id)).join(", ") || "없음"}</td><td className="px-3 py-3">{task.downstreamIds.length}건</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
