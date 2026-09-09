"use client";

import { useState } from "react";
import { buildOpsRadarReport } from "@/lib/demo/export-ops-radar";
import { parseOpsRadarSnapshot, serializeOpsRadarSnapshot, type OpsRadarSnapshot } from "@/lib/demo/ops-radar-snapshot";
import type { DemoTask, EvaluationResult } from "@/lib/demo/ops-radar-types";

interface SavedScenario {
  id: string;
  createdAt: string;
  snapshot: OpsRadarSnapshot;
}

export function OpsRadarStorage({
  scenarioId,
  scenarioTitle,
  tasks,
  result,
  onLoad,
}: {
  scenarioId: string;
  scenarioTitle: string;
  tasks: DemoTask[];
  result: EvaluationResult;
  onLoad: (snapshot: OpsRadarSnapshot) => void;
}) {
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/demo/artifacts?service=opsRadar&limit=20");
      if (!response.ok) throw new Error("load failed");
      const payload = await response.json();
      const valid = (Array.isArray(payload?.artifacts) ? payload.artifacts : []).flatMap((artifact: { id?: string; createdAt?: string; sourceText?: string }) => {
        try {
          return artifact.id && artifact.createdAt && artifact.sourceText
            ? [{ id: artifact.id, createdAt: artifact.createdAt, snapshot: parseOpsRadarSnapshot(artifact.sourceText) }]
            : [];
        } catch {
          return [];
        }
      });
      setSaved(valid);
      setSelectedId((current) => valid.some((item: SavedScenario) => item.id === current) ? current : (valid[0]?.id ?? ""));
      setMessage(valid.length ? `${valid.length}개 저장본을 불러왔습니다.` : "저장된 상황이 없습니다.");
    } catch {
      setMessage("저장본 조회에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    const report = buildOpsRadarReport(result);
    const markdown = [`# ${scenarioTitle}`, "", report.summary, "", ...report.actions.map((item) => `- ${item.task}: ${item.action}`)].join("\n");
    try {
      const snapshot = parseOpsRadarSnapshot(JSON.stringify({ scenarioId, scenarioTitle, tasks }));
      const sourceText = serializeOpsRadarSnapshot(snapshot);
      const response = await fetch("/api/demo/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "opsRadar",
          sourceText,
          result: {
            title: `${scenarioTitle} 저장본`,
            summary: report.summary,
            sections: [],
            actions: report.actions.map((item) => item.action),
            security: [],
            metrics: [],
            workItems: [],
            markdown,
            model: "deterministic-ops-radar-snapshot",
            generatedKeys: ["snapshot"],
            securityFlagCount: 0,
          },
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const payload = await response.json();
      const item = { id: String(payload.artifact.id), createdAt: String(payload.artifact.createdAt), snapshot };
      setSaved((current) => [item, ...current.filter((savedItem) => savedItem.id !== item.id)]);
      setSelectedId(item.id);
      setMessage("현재 상황을 DB에 저장했습니다.");
    } catch {
      setMessage("DB 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const load = () => {
    const item = saved.find((savedItem) => savedItem.id === selectedId);
    if (!item) return;
    onLoad(item.snapshot);
    setMessage("저장된 상황을 적용했습니다.");
  };

  return <section aria-labelledby="ops-storage-title" className="rounded-lg border border-slate-200 bg-white p-4">
    <h2 id="ops-storage-title" className="font-semibold text-slate-900">상황 저장·불러오기</h2>
    <p className="mt-1 text-sm text-slate-600">공개 시연용 공유 DB입니다. 실제 부대명·인명·좌표 등 민감정보는 저장하지 마세요.</p>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <button type="button" data-testid="ops-save-scenario" disabled={busy} onClick={save} className="rounded bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400">현재 상황 DB 저장</button>
      <button type="button" data-testid="ops-refresh-scenarios" disabled={busy} onClick={refresh} className="rounded border border-slate-400 px-3 py-2 text-sm disabled:text-slate-400">저장본 조회</button>
      <div className="min-w-0 flex-1">
        <label htmlFor="ops-saved-scenario" className="block text-xs font-medium text-slate-700">저장된 상황</label>
        <select id="ops-saved-scenario" data-testid="ops-saved-scenario" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" disabled={!saved.length}>
          {!saved.length ? <option value="">저장본 조회 필요</option> : saved.map((item) => <option key={item.id} value={item.id}>{item.snapshot.scenarioTitle} · {new Date(item.createdAt).toLocaleString("ko-KR")}</option>)}
        </select>
      </div>
      <button type="button" data-testid="ops-load-scenario" disabled={busy || !selectedId} onClick={load} className="rounded border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-900 disabled:border-slate-300 disabled:text-slate-400">선택 저장본 적용</button>
    </div>
    <p aria-live="polite" data-testid="ops-storage-status" className="mt-2 text-xs text-slate-600">{busy ? "처리 중..." : message}</p>
  </section>;
}
