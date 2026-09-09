"use client";

import { dependencyOptions } from "@/lib/demo/ops-radar-actions";
import type { DemoTask, RiskLevel, TaskState } from "@/lib/demo/ops-radar-types";

const RISK_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
  { value: "low", label: "낮음" },
  { value: "medium", label: "보통" },
  { value: "high", label: "높음" },
];

const STATE_OPTIONS: Array<{ value: TaskState; label: string }> = [
  { value: "open", label: "진행 중" },
  { value: "approval_pending", label: "승인 대기" },
  { value: "completed", label: "완료" },
];

const fieldClass = "mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700";
const labelClass = "block text-xs font-medium text-slate-700";

export function OpsRadarTaskEditor({
  tasks,
  task,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}: {
  tasks: DemoTask[];
  task: DemoTask;
  onSelect: (taskId: string) => void;
  onChange: (taskId: string, patch: Partial<DemoTask>) => void;
  onAdd: () => void;
  onDelete: (taskId: string) => void;
}) {
  const options = dependencyOptions(tasks, task.id);
  const toggleDependency = (dependencyId: string, checked: boolean) => {
    const dependencies = checked
      ? [...task.dependencies, dependencyId]
      : task.dependencies.filter((id) => id !== dependencyId);
    onChange(task.id, { dependencies });
  };

  return <section data-testid="ops-task-editor" aria-labelledby="ops-task-editor-title" className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="ops-task-editor-title" className="font-semibold text-slate-900">선택 업무 수정</h2>
        <p className="mt-1 text-sm text-slate-600">현재 선택한 업무의 값을 바꾸면 같은 규칙으로 즉시 다시 평가합니다.</p>
      </div>
      <div className="min-w-56">
        <label className={labelClass} htmlFor="ops-edit-task">편집할 업무</label>
        <select id="ops-edit-task" data-testid="ops-edit-task" className={fieldClass} value={task.id} onChange={(event) => onSelect(event.target.value)}>
          {tasks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <div className="mt-2 flex gap-2">
          <button type="button" data-testid="ops-add-task" onClick={onAdd} disabled={tasks.length >= 16} className="rounded border border-blue-700 px-3 py-1.5 text-sm text-blue-900 disabled:border-slate-300 disabled:text-slate-400">업무 추가</button>
          <button type="button" data-testid="ops-delete-task" onClick={() => onDelete(task.id)} disabled={tasks.length <= 1} className="rounded border border-red-700 px-3 py-1.5 text-sm text-red-800 disabled:border-slate-300 disabled:text-slate-400">선택 업무 삭제</button>
        </div>
      </div>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <label className={labelClass} htmlFor="ops-edit-title">업무명</label>
        <input id="ops-edit-title" data-testid="ops-edit-title" maxLength={60} className={fieldClass} value={task.title} onChange={(event) => onChange(task.id, { title: event.target.value })} />
      </div>
      <div>
        <label className={labelClass} htmlFor="ops-edit-owner">담당 부서</label>
        <input id="ops-edit-owner" data-testid="ops-edit-owner" maxLength={30} className={fieldClass} value={task.owner} onChange={(event) => onChange(task.id, { owner: event.target.value })} />
      </div>
      <div>
        <label className={labelClass} htmlFor="ops-edit-due">기한</label>
        <input id="ops-edit-due" data-testid="ops-edit-due" type="date" className={fieldClass} value={task.dueDate} onChange={(event) => onChange(task.id, { dueDate: event.target.value })} />
      </div>
      <div>
        <label className={labelClass} htmlFor="ops-edit-risk">위험도</label>
        <select id="ops-edit-risk" data-testid="ops-edit-risk" className={fieldClass} value={task.risk} onChange={(event) => onChange(task.id, { risk: event.target.value as RiskLevel })}>
          {RISK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="ops-edit-state">진행 상태</label>
        <select id="ops-edit-state" data-testid="ops-edit-state" className={fieldClass} value={task.state} onChange={(event) => onChange(task.id, { state: event.target.value as TaskState })}>
          {STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </div>

    <fieldset data-testid="ops-edit-dependencies" className="mt-4 rounded border border-slate-200 p-3">
      <legend className="px-1 text-xs font-medium text-slate-700">선행 업무 (자기 자신은 선택할 수 없습니다)</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => <label key={option.id} htmlFor={`ops-edit-dependency-${option.id}`} className="flex items-start gap-2 text-sm text-slate-800">
          <input
            id={`ops-edit-dependency-${option.id}`}
            data-testid={`ops-edit-dependency-${option.id}`}
            type="checkbox"
            className="mt-0.5 h-4 w-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            checked={task.dependencies.includes(option.id)}
            onChange={(event) => toggleDependency(option.id, event.target.checked)}
          />
          <span>{option.title}</span>
        </label>)}
      </div>
    </fieldset>
  </section>;
}
