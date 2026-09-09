"use client";

import { useEffect, useRef, useState } from "react";
import { OPS_RADAR_DOCUMENT_TYPES, buildOpsRadarAiSource, buildOpsRadarCsv, buildOpsRadarReport, opsRadarDocumentLabel, type OpsRadarDocumentType } from "@/lib/demo/export-ops-radar";
import type { DemoTask, EvaluationResult } from "@/lib/demo/ops-radar-types";

interface GeneratedDocument {
  title: string;
  summary: string;
  sections: Array<{ label: string; body: string }>;
  actions: string[];
  model: string;
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Presentation browsers can deny clipboard permission; use a local fallback.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try { succeeded = document.execCommand("copy"); } catch { succeeded = false; }
  textarea.remove();
  return succeeded;
}

const documentPlainText = (value: GeneratedDocument) => [
  value.title,
  "",
  value.summary,
  "",
  ...value.sections.map((section) => `[${section.label}]\n${section.body}`),
  "",
  "[후속조치]",
  ...value.actions.map((action) => `- ${action}`),
].join("\n");

export function OpsRadarReport({ result, tasks, scenarioTitle }: { result: EvaluationResult; tasks: DemoTask[]; scenarioTitle: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [documentType, setDocumentType] = useState<OpsRadarDocumentType>("command");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();
  const [aiDocument, setDocument] = useState<GeneratedDocument>();
  const [aiCopyState, setAiCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);
  const generationVersion = useRef(0);
  const report = buildOpsRadarReport(result);
  const reportText = `${report.summary}\n${report.actions.map((item) => `- ${item.task}: ${item.action}`).join("\n")}`;
  useEffect(() => {
    if (copyState !== "manual") return;
    manualCopyRef.current?.focus();
    manualCopyRef.current?.select();
  }, [copyState]);
  useEffect(() => {
    generationVersion.current += 1;
    setDocument(undefined);
    setError(undefined);
    setGenerating(false);
    setAiCopyState("idle");
  }, [tasks, scenarioTitle]);
  const handleCopy = async () => {
    const succeeded = await copyToClipboard(reportText);
    setCopyState(succeeded ? "copied" : "manual");
  };
  const handleDownload = () => { const blob = new Blob(["﻿" + buildOpsRadarCsv(result)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "ops-radar-demo.csv"; link.click(); URL.revokeObjectURL(url); };
  const handleGenerate = async () => {
    const version = ++generationVersion.current;
    setGenerating(true);
    setError(undefined);
    setAiCopyState("idle");
    try {
      const response = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "opsRadar",
          mode: documentType,
          sourceText: buildOpsRadarAiSource({ scenarioTitle, documentType, tasks, result }),
        }),
      });
      if (!response.ok) throw new Error("generate failed");
      const payload = await response.json();
      const generated = payload?.result;
      if (!generated?.title) throw new Error("empty result");
      if (version !== generationVersion.current) return;
      setDocument({
        title: String(generated.title),
        summary: String(generated.summary ?? ""),
        sections: Array.isArray(generated.sections) ? generated.sections.map((section: { label?: string; body?: string }) => ({ label: String(section?.label ?? "항목"), body: String(section?.body ?? "") })) : [],
        actions: Array.isArray(generated.actions) ? generated.actions.map((action: unknown) => String(action)) : [],
        model: String(generated.model ?? ""),
      });
    } catch {
      if (version !== generationVersion.current) return;
      setDocument(undefined);
      setError("보고문 생성에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      if (version === generationVersion.current) setGenerating(false);
    }
  };
  const handleAiCopy = async () => {
    if (!aiDocument) return;
    setAiCopyState(await copyToClipboard(documentPlainText(aiDocument)) ? "copied" : "failed");
  };
  const isModelGenerated = Boolean(aiDocument) && !/fallback|deterministic/i.test(aiDocument?.model ?? "");
  const modelSource = /^gemini(?:-|$)/i.test(aiDocument?.model ?? "") ? "Gemini 생성" : "AI 생성";
  return <section aria-labelledby="ops-report-title" className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="ops-report-title" className="font-semibold text-slate-900">보고 요약</h2><p className="text-xs text-slate-600">파일 다운로드만 제공하며 서버에는 저장하지 않습니다.</p></div><div className="flex gap-2"><button type="button" onClick={handleCopy} aria-live="polite" className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{copyState === "copied" ? "복사 완료" : copyState === "manual" ? "직접 복사 필요" : "보고문 복사"}</button><button type="button" onClick={handleDownload} className="rounded bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">CSV 다운로드</button></div></div>{copyState === "manual" ? <div role="status" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3"><p className="text-sm font-medium text-amber-950">자동 복사가 차단되었습니다. 선택된 내용을 Ctrl/Cmd+C로 복사하세요.</p><textarea ref={manualCopyRef} aria-label="보고문 직접 복사" readOnly value={reportText} onFocus={(event) => event.currentTarget.select()} className="mt-2 h-32 w-full resize-y rounded border border-amber-400 bg-white p-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700" /></div> : null}<p className="mt-3 text-sm leading-6 text-slate-700">{report.summary}</p><div className="mt-3 overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2">우선 조치</th><th className="p-2">담당</th><th className="p-2">기한</th></tr></thead><tbody>{report.actions.map((action) => <tr key={action.taskId} className="border-t border-slate-100"><td className="p-2"><span className="font-medium">{action.task}</span><br />{action.action}</td><td className="p-2">{action.owner}</td><td className="p-2">{action.dueDate}</td></tr>)}</tbody></table></div>

    <div data-testid="ops-ai-report" className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="font-semibold text-slate-900">보고문 생성</h3>
      <p className="mt-1 text-sm text-slate-600">현재 화면의 업무·선후행·병목 내용을 그대로 보고 문안으로 정리합니다.</p>
      <p data-testid="ops-ai-warning" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">비식별 합성 데이터 시연입니다. 실제 부대명·인명·좌표 등 민감정보는 입력하지 마세요.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-slate-700" htmlFor="ops-document-type">보고서 유형</label>
          <select id="ops-document-type" data-testid="ops-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as OpsRadarDocumentType)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
            {OPS_RADAR_DOCUMENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
        </div>
        <button type="button" data-testid="ops-generate-document" onClick={handleGenerate} disabled={generating} className="rounded bg-blue-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400">{generating ? "생성 중..." : `${opsRadarDocumentLabel(documentType)} 생성`}</button>
        {aiDocument ? <button type="button" data-testid="ops-ai-copy" onClick={handleAiCopy} className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{aiCopyState === "copied" ? "복사 완료 (한글·워드 붙여넣기)" : aiCopyState === "failed" ? "직접 복사 필요" : "생성 보고문 복사"}</button> : null}
      </div>
      <div aria-live="polite" className="mt-3">
        {generating ? <p data-testid="ops-ai-loading" className="text-sm text-slate-600">보고문을 생성하고 있습니다...</p> : null}
        {error ? <p data-testid="ops-ai-error" role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {aiDocument ? <article className="rounded border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 data-testid="ops-ai-title" className="font-semibold text-slate-900">{aiDocument.title}</h4>
            <span data-testid="ops-ai-source" className={`rounded px-2 py-1 text-xs font-medium ${isModelGenerated ? "bg-blue-100 text-blue-900" : "bg-slate-200 text-slate-800"}`}>{isModelGenerated ? `${modelSource} · ${aiDocument.model}` : "규칙 기반 대체문"}</span>
          </div>
          <p data-testid="ops-ai-summary" className="mt-2 text-sm leading-6 text-slate-700">{aiDocument.summary}</p>
          <dl data-testid="ops-ai-sections" className="mt-3 space-y-2">
            {aiDocument.sections.map((section, index) => <div key={`${section.label}-${index}`}>
              <dt className="text-sm font-medium text-slate-900">{section.label}</dt>
              <dd className="text-sm leading-6 text-slate-700">{section.body}</dd>
            </div>)}
          </dl>
          {aiDocument.actions.length > 0 ? <div className="mt-3">
            <p className="text-sm font-medium text-slate-900">후속조치</p>
            <ul data-testid="ops-ai-actions" className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {aiDocument.actions.map((action, index) => <li key={`${action}-${index}`}>{action}</li>)}
            </ul>
          </div> : null}
        </article> : null}
      </div>
    </div>
  </section>;
}
