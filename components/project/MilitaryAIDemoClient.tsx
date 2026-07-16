"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileText,
  GitBranch,
  ListChecks,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PublicDemoHeader } from "@/components/project/PublicDemoHeader";

type DemoToolId =
  | "adminDocument"
  | "meetingSummary"
  | "aarSummary"
  | "weeklyReport"
  | "securityScan";

interface DemoTool {
  id: DemoToolId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  accent: string;
}

interface DemoOutput {
  title: string;
  summary: string;
  sections: Array<{ label: string; body: string }>;
  actions: string[];
  security: Array<{ label: string; status: "pass" | "review"; note: string }>;
}

interface SavedNode {
  id: string;
  title: string;
  owner: string;
  status: string;
  body: string;
}

interface SavedDemoArtifact {
  id: string;
  service: string;
  title: string;
  summary: string;
  markdown: string;
  createdAt: string;
}

interface DemoResultPayload {
  title: string;
  summary: string;
  sections: Array<{ label: string; body: string }>;
  actions: string[];
  security: Array<{ label: string; status: "pass" | "review"; note: string }>;
  metrics: Array<{ label: string; value: string; note: string }>;
  workItems: Array<{ title: string; owner: string; status: string; risk: "low" | "medium" | "high" }>;
  markdown: string;
  model: string;
  generatedKeys: string[];
  securityFlagCount: number;
}

const tools: DemoTool[] = [
  {
    id: "adminDocument",
    label: "행정문서 초안",
    shortLabel: "문서",
    icon: FileText,
    accent: "border-cyan-300 bg-cyan-50 text-cyan-800",
  },
  {
    id: "meetingSummary",
    label: "회의록 요약",
    shortLabel: "회의",
    icon: ClipboardList,
    accent: "border-indigo-300 bg-indigo-50 text-indigo-800",
  },
  {
    id: "aarSummary",
    label: "훈련 AAR",
    shortLabel: "AAR",
    icon: ClipboardCheck,
    accent: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  {
    id: "weeklyReport",
    label: "주간상황보고",
    shortLabel: "주간",
    icon: ListChecks,
    accent: "border-amber-300 bg-amber-50 text-amber-800",
  },
  {
    id: "securityScan",
    label: "보안 검토",
    shortLabel: "보안",
    icon: ShieldCheck,
    accent: "border-rose-300 bg-rose-50 text-rose-800",
  },
];

const defaultSource =
  "7월 합동 점검 준비 회의. 장비 점검표 2건 미제출, 야간 통신 점검 일정 조정 필요. 군수반은 예비 배터리 현황을 금요일까지 공유하고, 작전계획반은 우천 시 대체 일정을 정리한다.";

const baseNodes: SavedNode[] = [
  {
    id: "NODE-104",
    title: "훈련 계획 초안",
    owner: "작전계획반",
    status: "진행",
    body: "7월 합동 점검 일정과 부서별 준비 현황을 정리한다.",
  },
  {
    id: "NODE-117",
    title: "장비 점검표 취합",
    owner: "군수반",
    status: "대기",
    body: "미제출 점검표 2건을 회수하고 예비 배터리 현황을 갱신한다.",
  },
  {
    id: "NODE-121",
    title: "지휘관 승인",
    owner: "참모부",
    status: "검토",
    body: "주요 위험요인과 대체 일정을 보고 전에 확인한다.",
  },
];

const templates: Record<DemoToolId, Omit<DemoOutput, "summary">> = {
  adminDocument: {
    title: "7월 합동 점검 준비 보고 초안",
    sections: [
      {
        label: "보고 목적",
        body: "부서별 준비 현황과 일정 조정 필요 사항을 지휘 계통에 간결하게 보고한다.",
      },
      {
        label: "핵심 내용",
        body: "장비 점검표 미제출 2건, 야간 통신 점검 조정, 우천 시 대체 일정 검토가 주요 확인 사항이다.",
      },
    ],
    actions: [
      "군수반: 예비 배터리 현황 금요일까지 제출",
      "작전계획반: 우천 시 대체 일정 초안 작성",
      "참모부: 보고 전 위험요인 문구 검토",
    ],
    security: [
      { label: "개인정보", status: "pass", note: "실명, 연락처, 군번 없음" },
      { label: "작전정보", status: "pass", note: "비식별 예시 일정만 포함" },
    ],
  },
  meetingSummary: {
    title: "합동 점검 준비 회의 요약",
    sections: [
      {
        label: "결정사항",
        body: "야간 통신 점검은 안전 통제 인원 배치 후 진행하며, 세부 시간은 부서별 입력 완료 후 확정한다.",
      },
      {
        label: "미결 사항",
        body: "장비 점검표 2건과 우천 시 실외 점검 대체안이 아직 확정되지 않았다.",
      },
    ],
    actions: [
      "미제출 부서 재안내",
      "안전 통제 체크리스트 갱신",
      "대체 일정 후보 2안 작성",
    ],
    security: [
      { label: "참석자 정보", status: "pass", note: "개인 이름 대신 부서명 사용" },
      { label: "세부 위치", status: "pass", note: "구체 좌표와 시설명 제외" },
    ],
  },
  aarSummary: {
    title: "훈련 사후검토 요약",
    sections: [
      {
        label: "유지할 점",
        body: "부서별 담당 과업이 그래프에 연결되어 병목 위치를 빠르게 확인할 수 있었다.",
      },
      {
        label: "개선할 점",
        body: "장비 점검표 입력 마감과 대체 일정 승인 흐름을 더 일찍 고정해야 한다.",
      },
    ],
    actions: [
      "점검표 제출 마감 D-3 고정",
      "위험요인 등록 양식 표준화",
      "AAR 결과를 다음 주간보고에 자동 반영",
    ],
    security: [
      { label: "훈련 세부", status: "review", note: "실훈련명 입력 전 비식별 필요" },
      { label: "자료 등급", status: "pass", note: "예시 데이터 기준 공개 가능" },
    ],
  },
  weeklyReport: {
    title: "주간상황보고 취합본",
    sections: [
      {
        label: "완료",
        body: "준비 회의 기록 정리, 부서별 담당자 확인, 점검표 현황판 구성 완료.",
      },
      {
        label: "진행",
        body: "장비 점검표 2건 회수와 야간 통신 점검 일정 조정이 진행 중이다.",
      },
    ],
    actions: [
      "차주 월요일까지 미제출 항목 회수",
      "수요일 참모 검토용 1페이지 요약 작성",
      "위험 항목 2건은 별도 추적",
    ],
    security: [
      { label: "보고 범위", status: "pass", note: "부대명과 담당자는 예시값" },
      { label: "첨부자료", status: "pass", note: "외부 파일 업로드 없음" },
    ],
  },
  securityScan: {
    title: "제출 전 보안 검토 결과",
    sections: [
      {
        label: "검토 결과",
        body: "현재 입력에는 실명, 군번, 연락처, 실제 위치, 세부 작전계획이 포함되어 있지 않다.",
      },
      {
        label: "권고 문구",
        body: "실제 제출 전에는 부대명, 담당자명, 일정, 장소를 한 번 더 마스킹한다.",
      },
    ],
    actions: [
      "실제 값 입력 전 비식별 사본 작성",
      "증빙 파일명에서 개인정보 제거",
      "최종 PDF 렌더 후 육안 검수",
    ],
    security: [
      { label: "민감정보", status: "pass", note: "탐지 항목 없음" },
      { label: "최종 제출", status: "review", note: "실제 증빙 추가 후 재검토 필요" },
    ],
  },
};

function makeOutput(toolId: DemoToolId, sourceText: string): DemoOutput {
  const template = templates[toolId];
  const normalized = sourceText.trim().replace(/\s+/g, " ");
  const excerpt = normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;

  return {
    ...template,
    summary: `${template.title}은 입력 메모의 핵심 위험요인과 후속조치를 분리해 정리했다. 입력 요약: ${excerpt}`,
  };
}

function makeMarkdown(tool: DemoTool, output: DemoOutput) {
  const sectionText = output.sections
    .map((section) => `## ${section.label}\n${section.body}`)
    .join("\n\n");
  const actions = output.actions.map((action) => `- ${action}`).join("\n");
  const security = output.security
    .map((item) => `- ${item.label}: ${item.note}`)
    .join("\n");

  return `# ${output.title}\n\n도구: ${tool.label}\n\n${output.summary}\n\n${sectionText}\n\n## 후속조치\n${actions}\n\n## 보안 검토\n${security}`;
}

function payloadFromOutput(tool: DemoTool, output: DemoOutput, markdown: string): DemoResultPayload {
  return {
    title: output.title,
    summary: output.summary,
    sections: output.sections,
    actions: output.actions,
    security: output.security,
    metrics: [
      { label: "AI 도구", value: "5", note: "공개 시연" },
      { label: "저장", value: "DB", note: "실제 저장" },
      { label: "보안", value: "검토", note: "자동 점검" },
    ],
    workItems: output.actions.slice(0, 4).map((action, index) => ({
      title: action,
      owner: index === 0 ? "AI 지원반" : "검토 담당",
      status: index === 0 ? "생성" : "검토",
      risk: index === 1 ? "medium" : "low",
    })),
    markdown,
    model: "initial-demo-state",
    generatedKeys: ["title", "summary", "sections", "actions", "security"],
    securityFlagCount: 0,
  };
}

function outputFromPayload(payload: DemoResultPayload): DemoOutput {
  return {
    title: payload.title,
    summary: payload.summary,
    sections: payload.sections,
    actions: payload.actions,
    security: payload.security,
  };
}

function nodeFromArtifact(artifact: SavedDemoArtifact): SavedNode {
  return {
    id: `DEMO-${artifact.id.slice(0, 8).toUpperCase()}`,
    title: artifact.title,
    owner: "공개 데모 저장소",
    status: "DB 저장",
    body: artifact.markdown,
  };
}

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

export function MilitaryAIDemoClient() {
  const [activeToolId, setActiveToolId] = useState<DemoToolId>("adminDocument");
  const [sourceText, setSourceText] = useState(defaultSource);
  const [output, setOutput] = useState<DemoOutput>(() =>
    makeOutput("adminDocument", defaultSource)
  );
  const initialTool = tools[0];
  const initialMarkdown = makeMarkdown(initialTool, makeOutput("adminDocument", defaultSource));
  const [generatedMarkdown, setGeneratedMarkdown] = useState(initialMarkdown);
  const [lastPayload, setLastPayload] = useState<DemoResultPayload>(() =>
    payloadFromOutput(initialTool, makeOutput("adminDocument", defaultSource), initialMarkdown)
  );
  const [savedNodes, setSavedNodes] = useState<SavedNode[]>(baseNodes);
  const [selectedNodeId, setSelectedNodeId] = useState(baseNodes[0].id);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");

  const activeTool = useMemo(
    () => tools.find((tool) => tool.id === activeToolId) ?? tools[0],
    [activeToolId]
  );
  const ActiveIcon = activeTool.icon;
  const selectedNode = savedNodes.find((node) => node.id === selectedNodeId) ?? savedNodes[0];

  useEffect(() => {
    let mounted = true;

    async function loadSavedArtifacts() {
      try {
        const response = await fetch("/api/demo/artifacts?service=militaryAi&limit=6");
        const body = await response.json();
        if (!mounted || !response.ok || !Array.isArray(body.artifacts)) return;

        const artifactNodes = body.artifacts.map(nodeFromArtifact);
        setSavedNodes([...artifactNodes, ...baseNodes]);
        if (artifactNodes[0]) setSelectedNodeId(artifactNodes[0].id);
      } catch {
        if (mounted) setError("저장된 데모 노드를 불러오지 못했습니다.");
      }
    }

    loadSavedArtifacts();
    return () => {
      mounted = false;
    };
  }, []);

  const generate = async () => {
    if (pendingAction) return;

    setCopied(false);
    setError("");
    setPendingAction("generate");

    try {
      const response = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "militaryAi",
          tool: activeToolId,
          sourceText: sourceText || defaultSource,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.result) {
        throw new Error(body.error || "AI 생성에 실패했습니다.");
      }
      const payload = body.result as DemoResultPayload;
      setLastPayload(payload);
      setGeneratedMarkdown(payload.markdown);
      setOutput(outputFromPayload(payload));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 생성에 실패했습니다.");
    } finally {
      setPendingAction("");
    }
  };

  const saveAsNode = async () => {
    if (pendingAction) return;

    setError("");
    setPendingAction("save");

    try {
      const response = await fetch("/api/demo/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "militaryAi",
          sourceText: sourceText || defaultSource,
          result: lastPayload,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.artifact) {
        throw new Error(body.error || "저장에 실패했습니다.");
      }
      const nextNode = nodeFromArtifact(body.artifact);
      setSavedNodes((current) => [nextNode, ...current.filter((node) => node.id !== nextNode.id)]);
      setSelectedNodeId(nextNode.id);
      setCopied(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "저장에 실패했습니다.");
    } finally {
      setPendingAction("");
    }
  };

  const reset = () => {
    if (pendingAction) return;

    setActiveToolId("adminDocument");
    setSourceText(defaultSource);
    const resetOutput = makeOutput("adminDocument", defaultSource);
    const resetMarkdown = makeMarkdown(tools[0], resetOutput);
    setOutput(resetOutput);
    setGeneratedMarkdown(resetMarkdown);
    setLastPayload(payloadFromOutput(tools[0], resetOutput, resetMarkdown));
    setSelectedNodeId(baseNodes[0].id);
    setCopied(false);
    setError("");
  };

  const copyMarkdown = async () => {
    if (pendingAction) return;

    setError("");

    try {
      await navigator.clipboard.writeText(generatedMarkdown);
      setCopied(true);
    } catch {
      setError("브라우저 복사 권한이 없어 Markdown을 복사하지 못했습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <PublicDemoHeader variant="militaryAi" title="문서지원 통합" />

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-semibold">입력</h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const active = tool.id === activeToolId;

                return (
                  <button
                    key={tool.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveToolId(tool.id)}
                    disabled={Boolean(pendingAction)}
                    className={`flex min-h-16 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? tool.accent
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{tool.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="demo-source">
              메모
            </label>
            <textarea
              id="demo-source"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              className="mt-2 min-h-56 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 outline-none transition focus:border-slate-400 focus:bg-white"
            />

            <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={Boolean(pendingAction)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {pendingAction === "generate" ? "Generating" : "Generate"}
              </button>
              <button
                type="button"
                onClick={saveAsNode}
                disabled={Boolean(pendingAction)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {pendingAction === "save" ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                aria-label="Reset demo"
                onClick={reset}
                disabled={Boolean(pendingAction)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
            {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
          </aside>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ActiveIcon className="h-5 w-5 text-slate-600" />
                  <h2 className="text-base font-semibold">AI 산출</h2>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-900">{output.title}</p>
              </div>
              <button
                type="button"
                onClick={copyMarkdown}
                disabled={Boolean(pendingAction)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Markdown"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-700">{output.summary}</p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {output.sections.map((section) => (
                <article key={section.label} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
                </article>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold">후속조치</h3>
                <div className="mt-3 space-y-2">
                  {output.actions.map((action) => (
                    <div key={action} className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="leading-5">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold">보안 검토</h3>
                <div className="mt-3 space-y-2">
                  {output.security.map((item) => (
                    <div key={item.label} className="flex items-start gap-2 text-sm">
                      {item.status === "pass" ? (
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <div>
                        <p className="font-medium text-slate-800">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-semibold">저장된 노드</h2>
            </div>

            <div className="mt-4 h-64 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="relative h-full">
                {savedNodes.slice(0, 4).map((node, index) => {
                  const positions = [
                    "left-[4%] top-[8%]",
                    "left-[48%] top-[18%]",
                    "left-[20%] top-[56%]",
                    "left-[60%] top-[62%]",
                  ];
                  const selected = node.id === selectedNodeId;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`absolute w-36 rounded-lg border p-2 text-left text-xs shadow-sm transition ${positions[index]} ${
                        selected
                          ? "border-slate-950 bg-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span className="font-semibold">{node.title}</span>
                      <span className="mt-1 block text-slate-500">{node.status}</span>
                    </button>
                  );
                })}
                <div className="absolute left-[32%] top-[35%] h-[2px] w-[25%] rotate-6 bg-slate-300" />
                <div className="absolute left-[38%] top-[54%] h-[2px] w-[25%] -rotate-12 bg-slate-300" />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-4" data-testid="saved-node-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{selectedNode.id}</p>
                  <h3 className="mt-1 text-sm font-semibold">{selectedNode.title}</h3>
                </div>
                <StatusBadge tone="bg-slate-100 text-slate-700">{selectedNode.status}</StatusBadge>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-500">{selectedNode.owner}</p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {selectedNode.body}
              </pre>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
