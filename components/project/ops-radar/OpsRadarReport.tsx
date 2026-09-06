"use client";

import { useEffect, useRef, useState } from "react";
import { buildOpsRadarCsv, buildOpsRadarReport } from "@/lib/demo/export-ops-radar";
import type { EvaluationResult } from "@/lib/demo/ops-radar-types";

export function OpsRadarReport({ result }: { result: EvaluationResult }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);
  const report = buildOpsRadarReport(result);
  const reportText = `${report.summary}\n${report.actions.map((item) => `- ${item.task}: ${item.action}`).join("\n")}`;
  useEffect(() => {
    if (copyState !== "manual") return;
    manualCopyRef.current?.focus();
    manualCopyRef.current?.select();
  }, [copyState]);
  const handleCopy = async () => {
    let succeeded = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportText);
        succeeded = true;
      }
    } catch {
      // Presentation browsers can deny clipboard permission; use a local fallback.
    }
    if (!succeeded) {
      const textarea = document.createElement("textarea");
      textarea.value = reportText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { succeeded = document.execCommand("copy"); } catch { succeeded = false; }
      textarea.remove();
    }
    setCopyState(succeeded ? "copied" : "manual");
  };
  const handleDownload = () => { const blob = new Blob(["\uFEFF" + buildOpsRadarCsv(result)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "ops-radar-demo.csv"; link.click(); URL.revokeObjectURL(url); };
  return <section aria-labelledby="ops-report-title" className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="ops-report-title" className="font-semibold text-slate-900">보고 요약</h2><p className="text-xs text-slate-600">파일 다운로드만 제공하며 서버에는 저장하지 않습니다.</p></div><div className="flex gap-2"><button type="button" onClick={handleCopy} aria-live="polite" className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{copyState === "copied" ? "복사 완료" : copyState === "manual" ? "직접 복사 필요" : "보고문 복사"}</button><button type="button" onClick={handleDownload} className="rounded bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">CSV 다운로드</button></div></div>{copyState === "manual" ? <div role="status" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3"><p className="text-sm font-medium text-amber-950">자동 복사가 차단되었습니다. 선택된 내용을 Ctrl/Cmd+C로 복사하세요.</p><textarea ref={manualCopyRef} aria-label="보고문 직접 복사" readOnly value={reportText} onFocus={(event) => event.currentTarget.select()} className="mt-2 h-32 w-full resize-y rounded border border-amber-400 bg-white p-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700" /></div> : null}<p className="mt-3 text-sm leading-6 text-slate-700">{report.summary}</p><div className="mt-3 overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2">우선 조치</th><th className="p-2">담당</th><th className="p-2">기한</th></tr></thead><tbody>{report.actions.map((action) => <tr key={action.taskId} className="border-t border-slate-100"><td className="p-2"><span className="font-medium">{action.task}</span><br />{action.action}</td><td className="p-2">{action.owner}</td><td className="p-2">{action.dueDate}</td></tr>)}</tbody></table></div></section>;
}
