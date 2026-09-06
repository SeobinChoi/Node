"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import type { EvaluationResult, EvaluatedTask } from "@/lib/demo/ops-radar-types";
import { statusLabel } from "@/lib/demo/export-ops-radar";

function taskTone(evaluated: boolean, status: EvaluatedTask["status"]) {
  if (!evaluated) return "border-slate-400 bg-slate-50";
  if (status === "delayed") return "border-red-600 bg-red-50";
  if (status === "approval_wait") return "border-amber-500 bg-amber-50";
  if (status === "blocked") return "border-orange-400 bg-orange-50";
  if (status === "completed") return "border-emerald-500 bg-emerald-50";
  return "border-blue-500 bg-blue-50";
}

function TaskNode({ data }: NodeProps<{ task: EvaluatedTask; bottleneck: boolean; evaluated: boolean; onSelect: (id: string) => void }>) {
  const { task, bottleneck, evaluated } = data;
  const tone = taskTone(evaluated, task.status);
  return <div className={`min-w-32 rounded-md border-2 p-2 text-left text-xs shadow-sm ${tone}`}>
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-slate-500 !bg-white" />
    <span className="block font-semibold text-slate-900">{task.title}</span><span className="mt-1 block text-slate-700">{evaluated ? statusLabel[task.status] : "평가 전"}</span>{evaluated && bottleneck ? <span className="mt-1 inline-block rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-bold text-white">병목</span> : null}
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-slate-500 !bg-white" />
  </div>;
}

const nodeTypes = { task: TaskNode };
export function OpsRadarGraph({ result, evaluated, onSelect }: { result: EvaluationResult; evaluated: boolean; onSelect: (id: string) => void }) {
  const [instance, setInstance] = useState<{ fitView: () => void } | null>(null);
  const bottleneckIds = useMemo(() => new Set(result.bottlenecks.map((reason) => reason.taskId)), [result.bottlenecks]);
  const taskTitles = useMemo(() => new Map(result.tasks.map((task) => [task.id, task.title])), [result.tasks]);
  const nodes = useMemo<Node[]>(() => result.tasks.map((task, index) => ({ id: task.id, type: "task", position: { x: (index % 4) * 190, y: Math.floor(index / 4) * 150 }, ariaLabel: `그래프 노드: ${task.title}`, data: { task, bottleneck: bottleneckIds.has(task.id), evaluated, onSelect } })), [result.tasks, bottleneckIds, evaluated, onSelect]);
  const edges = useMemo<Edge[]>(() => result.tasks.flatMap((task) => task.dependencies.map((dependency) => ({ id: `${dependency}-${task.id}`, source: dependency, target: task.id, markerEnd: { type: MarkerType.ArrowClosed }, animated: evaluated && task.status === "blocked" }))), [result.tasks, evaluated]);
  const fit = useCallback(() => instance?.fitView(), [instance]);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node[data-id]");
    if (!node?.dataset.id) return;
    event.preventDefault();
    onSelect(node.dataset.id);
  };
  return <section aria-labelledby="ops-graph-title" className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><div><h2 id="ops-graph-title" className="font-semibold text-slate-900">선후행 관계 그래프</h2><p className="text-xs text-slate-600">색상과 상태 텍스트로 진행 상황을 함께 표시합니다.</p></div><button type="button" onClick={fit} className="hidden rounded border border-slate-300 px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 sm:inline-flex">전체 보기</button></div>
    <div data-testid="ops-mobile-graph" className="mt-3 space-y-2 sm:hidden">
      <p className="text-xs text-slate-600">모바일에서는 각 업무와 선행 업무를 읽기 쉬운 카드로 표시합니다.</p>
      {result.tasks.map((task) => <button key={task.id} type="button" data-testid={`ops-mobile-node-${task.id}`} onClick={() => onSelect(task.id)} className={`w-full rounded-md border-2 p-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${taskTone(evaluated, task.status)}`}>
        <span className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-900">{task.title}</span><span className="shrink-0 text-xs font-medium text-slate-700">{evaluated ? statusLabel[task.status] : "평가 전"}</span></span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">선행 업무: {task.dependencies.length ? task.dependencies.map((id) => taskTitles.get(id)).join(", ") : "없음"}</span>
        {evaluated && bottleneckIds.has(task.id) ? <span className="mt-1 inline-block rounded bg-red-700 px-1.5 py-0.5 text-[11px] font-bold text-white">핵심 병목</span> : null}
      </button>)}
    </div>
    <div onKeyDown={handleKeyDown} className="pointer-events-none invisible absolute -left-[10000px] mt-3 h-[380px] w-[760px] overflow-hidden rounded border border-slate-100 sm:visible sm:static sm:block sm:w-auto sm:pointer-events-auto"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} elementsSelectable onNodeClick={(_, node) => onSelect(node.id)} onInit={setInstance} fitView minZoom={0.4}><Background /><Controls showInteractive={false} /></ReactFlow></div></section>;
}
