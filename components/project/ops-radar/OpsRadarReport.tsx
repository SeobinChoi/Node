"use client";

import { useEffect, useRef, useState } from "react";
import { AiTypewriter } from "@/components/project/AiTypewriter";
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

const documentTypePreview: Record<OpsRadarDocumentType, { purpose: string; sections: string }> = {
  command: { purpose: "지휘 판단에 필요한 현재 상황과 핵심 병목을 요약합니다.", sections: "현재 상황 · 핵심 병목 · 지휘 판단" },
  action: { purpose: "병목 원인별 실행 조치를 담당과 기한까지 정리합니다.", sections: "병목 원인 · 담당 · 기한 · 조치 방법" },
  weekly: { purpose: "이번 주 진행과 위험을 차주 계획으로 연결합니다.", sections: "완료 · 진행 · 위험 · 차주 계획" },
};

export function OpsRadarReport({ result, tasks, scenarioTitle }: { result: EvaluationResult; tasks: DemoTask[]; scenarioTitle: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [documentType, setDocumentType] = useState<OpsRadarDocumentType>("command");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();
  const [aiDocument, setDocument] = useState<GeneratedDocument>();
  const [aiCopyState, setAiCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [exportingHwpx, setExportingHwpx] = useState(false);
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
  const handleHwpxDownload = async () => {
    setExportingHwpx(true);
    setError(undefined);
    try {
      const response = await fetch("/api/demo/hwpx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: scenarioTitle, text: aiDocument ? documentPlainText(aiDocument) : reportText }),
      });
      if (!response.ok) throw new Error("export failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "ops-radar-report.hwpx";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("HWPX 파일 생성에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setExportingHwpx(false);
    }
  };
  const handleGenerate = async () => {
    const version = ++generationVersion.current;
    setGenerating(true);
    setDocument(undefined);
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
  const handleDocumentTypeChange = (value: OpsRadarDocumentType) => {
    generationVersion.current += 1;
    setDocumentType(value);
    setDocument(undefined);
    setGenerating(false);
    setError(undefined);
    setAiCopyState("idle");
  };
  const isModelGenerated = Boolean(aiDocument) && !/fallback|deterministic/i.test(aiDocument?.model ?? "");
  const modelSource = /^gemini(?:-|$)/i.test(aiDocument?.model ?? "") ? "Gemini 생성" : "AI 생성";
  return <section aria-labelledby="ops-report-title" data-tour-id="ops-radar-report" className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="ops-report-title" className="font-semibold text-slate-900">보고 요약</h2><p className="text-xs text-slate-600">CSV와 HWPX 파일은 생성 후 브라우저로 바로 내려받습니다.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={handleCopy} aria-live="polite" className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{copyState === "copied" ? "복사 완료" : copyState === "manual" ? "직접 복사 필요" : "보고문 복사"}</button><button type="button" onClick={handleDownload} className="rounded bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">CSV 다운로드</button><button type="button" data-testid="ops-hwpx-download" disabled={exportingHwpx || generating} onClick={handleHwpxDownload} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:bg-slate-400">{exportingHwpx ? "HWPX 생성 중..." : "HWPX 다운로드"}</button></div></div>{copyState === "manual" ? <div role="status" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3"><p className="text-sm font-medium text-amber-950">자동 복사가 차단되었습니다. 선택된 내용을 Ctrl/Cmd+C로 복사하세요.</p><textarea ref={manualCopyRef} aria-label="보고문 직접 복사" readOnly value={reportText} onFocus={(event) => event.currentTarget.select()} className="mt-2 h-32 w-full resize-y rounded border border-amber-400 bg-white p-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700" /></div> : null}<p className="mt-3 text-sm leading-6 text-slate-700">{report.summary}</p><div className="mt-3 overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2">우선 조치</th><th className="p-2">담당</th><th className="p-2">기한</th></tr></thead><tbody>{report.actions.map((action) => <tr key={action.taskId} className="border-t border-slate-100"><td className="p-2"><span className="font-medium">{action.task}</span><br />{action.action}</td><td className="p-2">{action.owner}</td><td className="p-2">{action.dueDate}</td></tr>)}</tbody></table></div>

    <div data-testid="ops-ai-report" className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="font-semibold text-slate-900">보고문 생성</h3>
      <p className="mt-1 text-sm text-slate-600">현재 화면의 업무·선후행·병목 내용을 그대로 보고 문안으로 정리합니다.</p>
      <p data-testid="ops-ai-warning" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">비식별 합성 데이터 시연입니다. 실제 부대명·인명·좌표 등 민감정보는 입력하지 마세요.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-slate-700" htmlFor="ops-document-type">보고서 유형</label>
          <select id="ops-document-type" data-testid="ops-document-type" data-tour-id="ops-report-type" value={documentType} onChange={(event) => handleDocumentTypeChange(event.target.value as OpsRadarDocumentType)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
            {OPS_RADAR_DOCUMENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
        </div>
        <div data-testid="ops-document-preview" className="w-full rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950 sm:flex-1">
          <p className="font-medium">{documentTypePreview[documentType].purpose}</p>
          <p className="mt-1 text-blue-800">{documentTypePreview[documentType].sections}</p>
        </div>
        <button type="button" data-testid="ops-generate-document" data-tour-id="ops-report-generate" onClick={handleGenerate} disabled={generating} className="rounded bg-blue-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400">{generating ? "생성 중..." : `${opsRadarDocumentLabel(documentType)} 생성`}</button>
        {aiDocument ? <button type="button" data-testid="ops-ai-copy" onClick={handleAiCopy} className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{aiCopyState === "copied" ? "복사 완료 (한글·워드 붙여넣기)" : aiCopyState === "failed" ? "직접 복사 필요" : "생성 보고문 복사"}</button> : null}
      </div>
      <div className="mt-3">
        {generating ? <p data-testid="ops-ai-loading" role="status" aria-live="polite" className="text-sm text-slate-600">보고문을 생성하고 있습니다...</p> : null}
        {error ? <p data-testid="ops-ai-error" role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {aiDocument ? (
          <AiTypewriter
            segments={[
              aiDocument.title,
              aiDocument.summary,
              ...aiDocument.sections.flatMap((section) => [section.label, section.body]),
              ...aiDocument.actions,
            ]}
            enabled={/^gemini(?:-|$)/i.test(aiDocument.model)}
            resetKey={generationVersion.current}
            completionMessage="Gemini 보고문 생성이 완료되었습니다."
          >
            {({ segments, isComplete, skip }) => {
              let index = 0;
              const title = segments[index++];
              const summary = segments[index++];
              const sections = aiDocument.sections.map(() => ({ label: segments[index++], body: segments[index++] }));
              const actions = aiDocument.actions.map(() => segments[index++]);
              return <article className="rounded border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 data-testid="ops-ai-title" className="font-semibold text-slate-900">{title}</h4>
                  <span data-testid="ops-ai-source" className={`rounded px-2 py-1 text-xs font-medium ${isModelGenerated ? "bg-blue-100 text-blue-900" : "bg-slate-200 text-slate-800"}`}>{isModelGenerated ? `${modelSource} · ${aiDocument.model}` : "규칙 기반 대체문"}</span>
                </div>
                <p data-testid="ops-ai-summary" className="mt-2 text-sm leading-6 text-slate-700">{summary}</p>
                <dl data-testid="ops-ai-sections" className="mt-3 space-y-2">
                  {sections.map((section, sectionIndex) => <div key={`${aiDocument.sections[sectionIndex].label}-${sectionIndex}`}>
                    <dt className="text-sm font-medium text-slate-900">{section.label}</dt>
                    <dd className="text-sm leading-6 text-slate-700">{section.body}</dd>
                  </div>)}
                </dl>
                {actions.length > 0 ? <div className="mt-3">
                  <p className="text-sm font-medium text-slate-900">후속조치</p>
                  <ul data-testid="ops-ai-actions" className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {actions.map((action, actionIndex) => <li key={`${actionIndex}-${aiDocument.actions[actionIndex]}`}>{action}</li>)}
                  </ul>
                </div> : null}
                {!isComplete && /^gemini(?:-|$)/i.test(aiDocument.model) ? <button type="button" onClick={skip} className="mt-3 text-xs font-semibold text-blue-800 underline">결과 바로 보기</button> : null}
              </article>;
            }}
          </AiTypewriter>
        ) : null}
        {aiDocument && !/^gemini(?:-|$)/i.test(aiDocument.model) ? <span className="sr-only" role="status">규칙 기반 대체문 표시가 완료되었습니다.</span> : null}
      </div>
    </div>
  </section>;
}
