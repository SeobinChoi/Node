"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Database,
  FileSearch,
  FileText,
  FolderOpen,
  Home,
  RefreshCcw,
  Save,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { PublicDemoHeader } from "@/components/project/PublicDemoHeader";
import { AiTypewriter } from "@/components/project/AiTypewriter";
import { publicDemoTourTarget } from "@/components/project/PublicDemoTour";
import {
  examplesForTool,
  type PublicDocumentExample,
  type PublicDocumentTool,
} from "@/lib/demo/public-document-examples";

export type PublicServiceDemoVariant = "adminDoc" | "afterAction";

interface DemoMode {
  id: string;
  label: string;
}

interface Metric {
  label: string;
  value: string;
  note: string;
  tone: string;
}

interface ResultSection {
  label: string;
  body: string;
}

interface WorkItem {
  title: string;
  owner: string;
  status: string;
  risk: "low" | "medium" | "high";
  dueDate?: string;
}

interface DemoConfig {
  title: string;
  subtitle: string;
  routeLabel: string;
  icon: LucideIcon;
  primaryAction: string;
  secondaryAction: string;
  inputLabel: string;
  defaultInput: string;
  modes: DemoMode[];
  metrics: Metric[];
  evidence: string[];
  savedTitle: string;
}

interface LiveDemoResult {
  title: string;
  summary: string;
  sections: ResultSection[];
  actions: string[];
  security: Array<{ label: string; status: "pass" | "review"; note: string }>;
  metrics: Array<{ label: string; value: string; note: string }>;
  workItems: WorkItem[];
  markdown: string;
  model: string;
}

interface SavedDemoArtifact {
  id: string;
  service: string;
  title: string;
  summary: string;
  markdown: string;
  createdAt: string;
}

const demoConfigs: Record<PublicServiceDemoVariant, DemoConfig> = {
  adminDoc: {
    title: "행정문서 작성지원",
    subtitle: "회의 메모를 행정문서 초안, 결재 요지, 보안 점검 목록으로 정리하는 공개 샘플 화면",
    routeLabel: "행정문서",
    icon: FileText,
    primaryAction: "초안 작성",
    secondaryAction: "요지 복사",
    inputLabel: "초안 작성 메모",
    defaultInput:
      "7월 합동 점검 준비 회의 결과를 보고한다. 장비 점검표 일부가 미제출되었고 야간 점검 일정은 안전 통제 인원 배치 후 확정한다. 제출 전 부대명과 담당자명은 비식별 처리한다.",
    modes: [
      { id: "report", label: "보고서" },
      { id: "approval", label: "결재" },
      { id: "security", label: "보안" },
    ],
    metrics: [
      {
        label: "문서블록",
        value: "5",
        note: "보고 구조",
        tone: "border-sky-200 bg-sky-50 text-sky-900",
      },
      {
        label: "보안주의",
        value: "0",
        note: "예시 기준",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      },
      {
        label: "검토단계",
        value: "3",
        note: "제출 전",
        tone: "border-violet-200 bg-violet-50 text-violet-900",
      },
    ],
    evidence: [
      "공개 페이지에서 결재 문서 흐름을 직접 조작 가능",
      "문서 작성은 Gemini API를 사용하며 장애 시 샘플 fallback으로 명시",
      "보고서에는 실제 증빙이 아닌 샘플 서비스 화면으로 표기 필요",
    ],
    savedTitle: "임시 문서 초안",
  },
  afterAction: {
    title: "사후조치 주간요약",
    subtitle: "회의록, 훈련 사후검토, 주간상황보고를 사후조치 목록으로 정리하는 공개 샘플 화면",
    routeLabel: "사후조치",
    icon: ClipboardCheck,
    primaryAction: "요약 생성",
    secondaryAction: "조치 내보내기",
    inputLabel: "회의·훈련 메모",
    defaultInput:
      "이번 주 준비 회의에서 점검표 입력 마감이 늦어졌고 위험요인 등록 방식이 부서마다 달랐다. 다음 주에는 입력 마감을 D-3으로 고정하고 AAR 결과를 주간상황보고에 자동 반영한다.",
    modes: [
      { id: "aar", label: "사후검토" },
      { id: "weekly", label: "주간" },
      { id: "actions", label: "조치" },
    ],
    metrics: [
      {
        label: "교훈사항",
        value: "4",
        note: "유지/개선",
        tone: "border-teal-200 bg-teal-50 text-teal-900",
      },
      {
        label: "미결조치",
        value: "6",
        note: "추적 필요",
        tone: "border-amber-200 bg-amber-50 text-amber-900",
      },
      {
        label: "주간보고",
        value: "3",
        note: "보고 반영",
        tone: "border-indigo-200 bg-indigo-50 text-indigo-900",
      },
    ],
    evidence: [
      "사후검토, 회의록, 주간보고가 한 화면에 연결됨",
      "민감 실제 훈련명 없이 예시 일정과 부서명만 사용",
      "저장 결과는 공개 데모 저장소에 보관되며 화면에서 다시 확인 가능",
    ],
    savedTitle: "사후조치 묶음",
  },
};

const riskTone: Record<WorkItem["risk"], string> = {
  low: "border border-slate-300 bg-white text-slate-700",
  medium: "border border-amber-500 bg-white text-amber-800",
  high: "border border-red-700 bg-white text-red-800",
};

const riskLabel: Record<WorkItem["risk"], string> = {
  low: "낮음",
  medium: "주의",
  high: "높음",
};

function generationLabel(model: string) {
  if (/fallback/i.test(model)) return "샘플 fallback";
  return /^gemini(?:-|$)/i.test(model) ? "Gemini 생성" : `AI 생성 · ${model}`;
}

function resultTextSegments(result: LiveDemoResult): string[] {
  return [
    result.title,
    result.summary,
    ...result.sections.flatMap((section) => [section.label, section.body]),
  ];
}

function resultWithSegments(result: LiveDemoResult, segments: string[]): LiveDemoResult {
  let index = 0;
  return {
    ...result,
    title: segments[index++],
    summary: segments[index++],
    sections: result.sections.map(() => ({ label: segments[index++], body: segments[index++] })),
  };
}

function ResultSectionBlock({ section }: { section: ResultSection }) {
  return (
    <section className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{section.body}</p>
    </section>
  );
}

function emptyResult(): LiveDemoResult {
  return {
    title: "",
    summary: "",
    sections: [],
    actions: [],
    security: [],
    metrics: [],
    workItems: [],
    markdown: "",
    model: "",
  };
}

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SavedArtifactList({ artifacts }: { artifacts: SavedDemoArtifact[] }) {
  if (artifacts.length === 0) {
    return (
      <p className="mt-3 text-xs leading-5 text-slate-500">
        아직 저장된 결과가 없습니다. 생성 후 저장 버튼을 누르면 이 목록에 남습니다.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {artifacts.slice(0, 3).map((artifact) => (
        <div key={artifact.id} className="border border-slate-200 bg-white p-2">
          <p className="truncate text-xs font-semibold text-slate-900">{artifact.title}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {new Date(artifact.createdAt).toLocaleString("ko-KR")}
          </p>
        </div>
      ))}
    </div>
  );
}

function ModeButtons({
  config,
  mode,
  setMode,
  tone = "slate",
  disabled = false,
}: {
  config: DemoConfig;
  mode: string;
  setMode: (mode: string) => void;
  tone?: "slate" | "blue" | "dark";
  disabled?: boolean;
}) {
  const active =
    tone === "dark"
      ? "bg-slate-700 text-white"
      : tone === "blue"
        ? "bg-[#174f86] text-white"
        : "bg-slate-700 text-white";
  const idle =
    tone === "dark"
      ? "text-slate-300 hover:text-white"
      : tone === "blue"
        ? "text-slate-600 hover:text-blue-800"
        : "text-slate-600 hover:text-slate-950";

  return (
    <div
      className={`grid grid-cols-3 border ${
        tone === "dark" ? "border-slate-600 bg-slate-100" : "border-slate-300 bg-white"
      }`}
    >
      {config.modes.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setMode(item.id)}
          disabled={disabled}
          className={`border-r border-slate-300 px-2 py-2 text-sm font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60 ${
            mode === item.id ? active : idle
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PrimaryActionButton({
  label,
  onClick,
  tone,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone: "dark" | "blue" | "green";
  disabled?: boolean;
}) {
  const colors = {
    dark: "border-[#173f61] bg-[#173f61] text-white hover:bg-[#0f304c]",
    blue: "border-[#174f86] bg-[#174f86] text-white hover:bg-[#103c68]",
    green: "border-[#15523d] bg-[#15523d] text-white hover:bg-[#0f3e2e]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${colors[tone]}`}
    >
      <RefreshCcw className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function SecondaryActionButton({
  label,
  onClick,
  tone,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone: "dark" | "blue" | "green";
  disabled?: boolean;
}) {
  const colors = {
    dark: "border-[#173f61] bg-white text-[#173f61] hover:bg-slate-100",
    blue: "border-[#174f86] bg-white text-[#174f86] hover:bg-slate-100",
    green: "border-[#15523d] bg-white text-[#15523d] hover:bg-slate-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${colors[tone]}`}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

interface DemoState {
  config: DemoConfig;
  variant: PublicServiceDemoVariant;
  mode: string;
  setMode: (mode: string) => void;
  sourceText: string;
  setSourceText: (value: string) => void;
  examples: PublicDocumentExample[];
  selectedExampleId: string;
  selectExample: (exampleId: string) => void;
  hasResult: boolean;
  result: LiveDemoResult;
  displayMetrics: Metric[];
  savedArtifacts: SavedDemoArtifact[];
  savedCount: number;
  copied: boolean;
  pendingAction: string;
  error: string;
  sourceWordCount: number;
  generationKey: number;
  runPrimaryAction: () => void;
  runSecondaryAction: () => void;
  cancelPending: () => void;
}

function TypewrittenDemoResult({
  state,
  children,
}: {
  state: DemoState;
  children: (result: LiveDemoResult, complete: boolean, skip: () => void) => ReactNode;
}) {
  const animated = state.hasResult && /^gemini(?:-|$)/i.test(state.result.model);
  return (
    <>
      <AiTypewriter
        segments={resultTextSegments(state.result)}
        enabled={animated}
        resetKey={state.generationKey}
        completionMessage="Gemini 문서 생성이 완료되었습니다."
      >
        {({ segments, isComplete, skip }) => children(resultWithSegments(state.result, segments), isComplete, skip)}
      </AiTypewriter>
      {state.hasResult && !animated ? <span className="sr-only" role="status">대체 결과 표시가 완료되었습니다.</span> : null}
    </>
  );
}

function toolForMode(variant: PublicServiceDemoVariant, mode: string): PublicDocumentTool {
  if (variant === "adminDoc") {
    if (mode === "approval") return "approvalDocument";
    if (mode === "security") return "securityScan";
    return "adminDocument";
  }
  if (mode === "weekly") return "weeklyReport";
  if (mode === "actions") return "meetingSummary";
  return "aarSummary";
}

export function PublicServiceDemoClient({
  variant,
}: {
  variant: PublicServiceDemoVariant;
}) {
  const config = demoConfigs[variant];
  const initialMode = config.modes[0]?.id ?? "default";
  const initialExample = examplesForTool(toolForMode(variant, initialMode))[0];
  const [mode, setMode] = useState(initialMode);
  const [selectedExampleId, setSelectedExampleId] = useState(initialExample.id);
  const [sourceText, setSourceText] = useState(initialExample.sourceText);
  const [result, setResult] = useState<LiveDemoResult>(emptyResult);
  const [savedArtifacts, setSavedArtifacts] = useState<SavedDemoArtifact[]>([]);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const requestVersion = useRef(0);
  const examples = useMemo(() => examplesForTool(toolForMode(variant, mode)), [mode, variant]);

  useEffect(() => {
    let mounted = true;

    async function loadArtifacts() {
      try {
        const response = await fetch(`/api/demo/artifacts?service=${variant}&limit=6`);
        const body = await response.json();
        if (mounted && response.ok && Array.isArray(body.artifacts)) {
          setSavedArtifacts(body.artifacts);
        }
      } catch {
        if (mounted) setError("저장 목록을 불러오지 못했습니다.");
      }
    }

    loadArtifacts();
    return () => {
      mounted = false;
    };
  }, [variant]);

  const sourceWordCount = useMemo(
    () => sourceText.trim().split(/\s+/).filter(Boolean).length,
    [sourceText],
  );

  const displayMetrics = useMemo(() => {
    const liveMetrics = hasResult ? result.metrics : [];
    return liveMetrics.slice(0, 3).map((metric, index) => ({
      ...config.metrics[index % config.metrics.length],
      ...metric,
      tone: config.metrics[index % config.metrics.length].tone,
    }));
  }, [config.metrics, hasResult, result.metrics]);

  function clearResult() {
    requestVersion.current += 1;
    setHasResult(false);
    setResult(emptyResult);
    setCopied(false);
    setError("");
  }

  function changeMode(nextMode: string) {
    if (nextMode === mode) return;
    const example = examplesForTool(toolForMode(variant, nextMode))[0];
    clearResult();
    setMode(nextMode);
    setSelectedExampleId(example.id);
    setSourceText(example.sourceText);
  }

  function selectExample(exampleId: string) {
    const example = examples.find((item) => item.id === exampleId);
    if (!example) return;
    clearResult();
    setSelectedExampleId(example.id);
    setSourceText(example.sourceText);
  }

  function editSource(value: string) {
    clearResult();
    setSourceText(value);
  }

  async function runPrimaryAction() {
    if (pendingAction) return;

    const version = ++requestVersion.current;
    setCopied(false);
    setError("");
    setHasResult(false);
    setPendingAction(config.primaryAction);

    try {
      const response = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: variant, mode, sourceText, exampleId: selectedExampleId }),
      });
      const body = await response.json();
      if (!response.ok || !body.result) {
        throw new Error(body.error || "생성에 실패했습니다.");
      }
      if (version === requestVersion.current) {
        setResult(body.result);
        setHasResult(true);
      }
    } catch (requestError) {
      if (version === requestVersion.current) {
        setError(requestError instanceof Error ? requestError.message : "생성에 실패했습니다.");
      }
    } finally {
      setPendingAction("");
    }
  }

  async function saveCurrentResult() {
    const response = await fetch("/api/demo/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: variant, sourceText, result }),
    });
    const body = await response.json();
    if (!response.ok || !body.artifact) {
      throw new Error(body.error || "저장에 실패했습니다.");
    }
    setSavedArtifacts((current) => [body.artifact, ...current.filter((item) => item.id !== body.artifact.id)].slice(0, 6));
  }

  async function runSecondaryAction() {
    if (pendingAction || !hasResult) return;

    setError("");
    setPendingAction(config.secondaryAction);

    try {
      if (variant === "adminDoc") {
        try {
          await navigator.clipboard.writeText(result.markdown);
        } catch {
          setError("브라우저 복사 권한이 없어 저장만 완료했습니다.");
        }
      } else if (variant === "afterAction") {
        downloadMarkdown("after-action-demo.md", result.markdown);
      }
      await saveCurrentResult();
      setCopied(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "동작을 완료하지 못했습니다.");
    } finally {
      setPendingAction("");
    }
  }

  const state: DemoState = {
    config,
    variant,
    mode,
    setMode: changeMode,
    sourceText,
    setSourceText: editSource,
    examples,
    selectedExampleId,
    selectExample,
    hasResult,
    result,
    displayMetrics,
    savedArtifacts,
    savedCount: savedArtifacts.length,
    copied,
    pendingAction,
    error,
    sourceWordCount,
    generationKey: requestVersion.current,
    runPrimaryAction,
    runSecondaryAction,
    cancelPending: clearResult,
  };

  if (variant === "adminDoc") {
    return <AdminDocumentPortal state={state} />;
  }

  return <AfterActionBoard state={state} />;
}

type AdminGenerationMode = "report" | "approval" | "security";
type AdminView = "guide" | AdminGenerationMode | "drafts";

const ADMIN_NAV_ITEMS: Array<{ id: AdminView; label: string }> = [
  { id: "guide", label: "작성안내" },
  { id: "report", label: "보고서식" },
  { id: "approval", label: "결재요지" },
  { id: "security", label: "보안검토" },
  { id: "drafts", label: "나의 임시문서" },
];

const ADMIN_GENERATION_COPY: Record<
  AdminGenerationMode,
  { helper: string; ctaHint: string; resultLabel: string }
> = {
  report: {
    helper: "회의나 점검 메모를 목적·현황·문제점·조치계획 순서의 보고서 초안으로 정리합니다.",
    ctaHint: "메모를 정리해 보고서 초안을 만듭니다.",
    resultLabel: "보고서 미리보기",
  },
  approval: {
    helper: "결재 요청에 필요한 추진 근거와 요청사항을 정리해 결재 문서를 만듭니다.",
    ctaHint: "결재 요청 문서를 작성합니다.",
    resultLabel: "결재 문서 미리보기",
  },
  security: {
    helper: "제출 전 개인정보·세부 위치·기관명 등 민감정보 노출 여부를 점검합니다.",
    ctaHint: "민감정보 마스킹 여부를 검토합니다.",
    resultLabel: "보안 검토 결과",
  },
};

function AdminGuidePanel() {
  return (
    <section data-testid="admin-guide-panel" className="border border-slate-400 bg-white p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <BookOpen className="h-5 w-5 text-[#174f86]" aria-hidden="true" />
        작성안내
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        왼쪽 메뉴에서 만들 문서 종류를 고르면 입력창과 결과 형식이 그 종류에 맞게 바뀝니다.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {(Object.keys(ADMIN_GENERATION_COPY) as AdminGenerationMode[]).map((key) => (
          <div key={key} className="border border-slate-300 bg-slate-50 p-3">
            <dt className="text-sm font-semibold text-[#174f86]">
              {ADMIN_NAV_ITEMS.find((item) => item.id === key)?.label}
            </dt>
            <dd className="mt-1 text-xs leading-5 text-slate-600">{ADMIN_GENERATION_COPY[key].helper}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AdminGenerationPanel({
  state,
  adminView,
}: {
  state: DemoState;
  adminView: AdminGenerationMode;
}) {
  const { config, sourceText, setSourceText } = state;
  const copy = ADMIN_GENERATION_COPY[adminView];

  return (
    <div data-testid="admin-generation-panel" className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="min-w-0 border border-slate-400 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">문서작성 입력</h2>
          <FileSearch className="h-5 w-5 text-[#174f86]" aria-hidden="true" />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.helper}</p>
        <label htmlFor="adminDoc-example" className="mt-5 block text-sm font-semibold">예시 입력</label>
        <select
          id="adminDoc-example"
          aria-label="예시 입력"
          value={state.selectedExampleId}
          onChange={(event) => state.selectExample(event.target.value)}
          className="mt-2 h-10 w-full border border-slate-400 bg-white px-3 text-sm"
        >
          {state.examples.map((example) => (
            <option key={example.id} value={example.id}>{example.label}</option>
          ))}
        </select>
        <label htmlFor="adminDoc-source" className="mt-5 block text-sm font-semibold">
          {config.inputLabel}
        </label>
        <textarea
          id="adminDoc-source"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          className="mt-2 min-h-44 w-full resize-y border border-slate-400 bg-white p-3 text-sm leading-6 outline-none focus:border-[#174f86]"
        />
        <p className="mt-2 text-xs leading-5 text-amber-700">
          입력은 Gemini로 전송됩니다. 실제 개인정보·군번·좌표·작전정보는 입력하지 마세요. 탐지 시 전송을 차단합니다.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <span className="border border-slate-300 bg-slate-50 px-3 py-2">단어 {state.sourceWordCount}</span>
          <span className="border border-slate-300 bg-slate-50 px-3 py-2">{state.hasResult ? generationLabel(state.result.model) : "생성 전"}</span>
        </div>
        <p className="mt-4 text-xs font-semibold text-[#174f86]">{copy.ctaHint}</p>
        <div className="mt-2 flex flex-wrap gap-2" {...publicDemoTourTarget("admin-doc-generate")}>
          <PrimaryActionButton
            label={state.pendingAction === config.primaryAction ? "작성 중" : config.primaryAction}
            onClick={state.runPrimaryAction}
            tone="blue"
            disabled={Boolean(state.pendingAction)}
          />
          <SecondaryActionButton
            label={state.pendingAction === config.secondaryAction ? "처리 중" : config.secondaryAction}
            onClick={state.runSecondaryAction}
            tone="blue"
            disabled={Boolean(state.pendingAction) || !state.hasResult}
          />
        </div>
        {state.error ? <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
      </section>

      {!state.hasResult ? (
        <section className="border border-dashed border-slate-400 bg-slate-50 p-5 text-sm text-slate-600">
          문서를 작성하면 {copy.resultLabel}가 여기에 표시됩니다.
        </section>
      ) : null}
      <TypewrittenDemoResult state={state}>
        {(visibleResult, complete, skip) => <article
          data-testid="demo-result-panel"
          hidden={!state.hasResult}
          className="border border-slate-400 bg-white p-5"
          {...publicDemoTourTarget("admin-doc-result")}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <p className="text-sm font-semibold text-[#174f86]">{copy.resultLabel}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-normal">{visibleResult.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{generationLabel(state.result.model)}</p>
            </div>
            <span className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {state.copied ? "복사/저장됨" : state.pendingAction || "작성중"}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{visibleResult.summary}</p>
          <div className="mt-5 space-y-4">
            {visibleResult.sections.map((section, index) => (
              <ResultSectionBlock key={`${state.result.sections[index]?.label}-${index}`} section={section} />
            ))}
          </div>
          {!complete && /^gemini(?:-|$)/i.test(state.result.model) ? <button type="button" onClick={skip} className="mt-4 text-xs font-semibold text-[#174f86] underline">결과 바로 보기</button> : null}
        </article>}
      </TypewrittenDemoResult>
    </div>
  );
}

function AdminDraftsPanel({
  artifacts,
  savedTitle,
}: {
  artifacts: SavedDemoArtifact[];
  savedTitle: string;
}) {
  return (
    <section data-testid="admin-drafts-panel" className="border border-slate-400 bg-white p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <FolderOpen className="h-5 w-5 text-[#174f86]" aria-hidden="true" />
        나의 임시문서
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {savedTitle} 등 저장된 항목 {artifacts.length}건입니다. 요지 복사를 누르면 여기에 새 항목이 추가됩니다.
      </p>
      {artifacts.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-slate-500">아직 저장된 임시문서가 없습니다.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {artifacts.map((artifact) => (
            <li key={artifact.id} className="border border-slate-300 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{artifact.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(artifact.createdAt).toLocaleString("ko-KR")}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{artifact.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isAdminGenerationView(view: AdminView): view is AdminGenerationMode {
  return view === "report" || view === "approval" || view === "security";
}

function AdminDocumentPortal({ state }: { state: DemoState }) {
  const { config } = state;
  const [adminView, setAdminView] = useState<AdminView>("report");

  function selectAdminView(view: AdminView) {
    if (view === "report" || view === "approval" || view === "security") {
      state.setMode(view);
    } else {
      state.cancelPending();
    }
    setAdminView(view);
  }

  return (
    <main className="min-h-screen bg-[#eef2f5] text-slate-950">
      <PublicDemoHeader variant="adminDoc" title={config.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[250px_1fr] lg:px-8">
        <aside className="border border-slate-400 bg-white">
          <div className="border-b border-slate-300 bg-[#174f86] px-4 py-3 text-sm font-semibold text-white">
            행정서비스
          </div>
          <div className="divide-y divide-slate-100 text-sm" {...publicDemoTourTarget("admin-doc-type")}>
            {ADMIN_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={adminView === item.id}
                onClick={() => selectAdminView(item.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                  adminView === item.id ? "bg-[#e5eef7] font-semibold text-[#174f86]" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="p-4">
            <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
              <div className="flex items-center gap-2 font-semibold text-[#174f86]">
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                담당 확인
              </div>
              <p className="mt-2 leading-6">실제 담당자명 없이 예시 부서명만 사용합니다.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {state.displayMetrics.map((metric) => (
              <div key={metric.label} className="border border-slate-400 bg-white p-4">
                <p className="text-sm font-semibold text-[#174f86]">{metric.label}</p>
                <div className="mt-2 flex items-end justify-between">
                  <strong className="text-3xl font-semibold tracking-normal">{metric.value}</strong>
                  <span className="border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    {metric.note}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {adminView === "guide" ? <AdminGuidePanel /> : null}
          {isAdminGenerationView(adminView) ? <AdminGenerationPanel state={state} adminView={adminView} /> : null}
          {adminView === "drafts" ? (
            <AdminDraftsPanel artifacts={state.savedArtifacts} savedTitle={config.savedTitle} />
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <section className="min-w-0 border border-slate-400 bg-white p-5">
              <div className="flex items-center gap-2 text-base font-semibold">
                <ClipboardList className="h-5 w-5 text-[#174f86]" aria-hidden="true" />
                처리현황
              </div>
              <div className="mt-4 overflow-x-auto border border-slate-300">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[minmax(220px,1fr)_120px_100px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                    <span>항목</span>
                    <span>담당</span>
                    <span>상태</span>
                  </div>
                  {state.result.workItems.map((item) => (
                    <div
                      key={item.title}
                      className="grid grid-cols-[minmax(220px,1fr)_120px_100px] border-t border-slate-200 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-slate-600">{item.owner}</span>
                      <span className={`w-fit px-2 py-1 text-xs font-semibold ${riskTone[item.risk]}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              data-testid="saved-service-panel"
              className="border border-slate-400 bg-white p-5"
            >
              <div className="flex items-center gap-2 text-base font-semibold">
                <Save className="h-5 w-5 text-[#174f86]" aria-hidden="true" />
                임시저장
              </div>
              <p className="mt-4 text-sm font-semibold">{config.savedTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                저장된 시연 항목 {state.savedCount}건. 복사한 요지는 공개 데모 저장소에 실제로 보관된다.
              </p>
              <SavedArtifactList artifacts={state.savedArtifacts} />
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {config.evidence.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#174f86]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

type AfterActionMode = "aar" | "weekly" | "actions";

const AFTER_ACTION_COPY: Record<AfterActionMode, { description: string; inputHint: string; cta: string }> = {
  aar: {
    description: "회의록과 훈련 사후검토 메모에서 유지할 점과 개선할 점을 분리해 정리합니다.",
    inputHint: "회의록과 훈련 사후검토 메모를 입력하세요.",
    cta: "요약 생성",
  },
  weekly: {
    description: "이번 주 완료·진행 현황과 차주 계획을 주간상황보고 형식으로 정리합니다.",
    inputHint: "이번 주 진행 상황과 차주 계획이 담긴 메모를 입력하세요.",
    cta: "주간보고 생성",
  },
  actions: {
    description: "조치사항마다 담당 부서와 마감일을 정리해 추적 목록을 만듭니다.",
    inputHint: "담당자와 마감일이 포함된 조치사항 메모를 입력하세요.",
    cta: "조치 목록 생성",
  },
};

function afterActionCopyForMode(mode: string): (typeof AFTER_ACTION_COPY)[AfterActionMode] {
  return AFTER_ACTION_COPY[mode as AfterActionMode] ?? AFTER_ACTION_COPY.aar;
}

function AfterActionResultSections({ mode, sections }: { mode: string; sections: ResultSection[] }) {
  if (mode === "weekly") {
    return (
      <div className="mt-5 space-y-3">
        {sections.map((section, index) => (
          <div
            key={index}
            className={`border p-3 ${
              section.label.includes("차주") ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"
            }`}
          >
            <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-700">{section.body}</p>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "actions") {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {sections.map((section, index) => (
          <div key={index} className="border border-slate-300 bg-white p-3">
            <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-700">{section.body}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-5 border border-slate-300">
      {sections.map((section, index) => (
        <section
          key={index}
          className="grid border-t border-slate-300 first:border-t-0 md:grid-cols-[160px_1fr]"
        >
          <h3 className="bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950">{section.label}</h3>
          <p className="px-3 py-3 text-sm leading-6 text-slate-700">{section.body}</p>
        </section>
      ))}
    </div>
  );
}

function AfterActionBoard({ state }: { state: DemoState }) {
  const { config, mode, setMode, sourceText, setSourceText } = state;
  const modeCopy = afterActionCopyForMode(mode);

  return (
    <main className="min-h-screen bg-[#edf3f0] text-slate-950">
      <PublicDemoHeader variant="afterAction" title={config.title} />

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="border border-slate-400 bg-white">
          <div className="grid border-b border-slate-300 lg:grid-cols-[1fr_360px]">
            <div className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#15523d]">
                <Home className="h-4 w-4" aria-hidden="true" />
                홈 &gt; 사후조치 &gt; 주간상황요약
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal">사후조치 통합 현황</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{config.subtitle}</p>
            </div>
            <div className="border-t border-slate-300 bg-slate-50 text-sm lg:border-l lg:border-t-0">
              {[
                ["업무구분", "사후조치"],
                ["기준일", "2026-07-03"],
                ["공개범위", "샘플 데이터"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] border-b border-slate-300 last:border-b-0">
                  <span className="bg-white px-3 py-3 font-semibold text-slate-700">{label}</span>
                  <span className="px-3 py-3 text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-3">
            {state.displayMetrics.map((metric) => (
              <div key={metric.label} className="border-b border-slate-300 p-4 md:border-r md:last:border-r-0">
                <p className="text-sm font-semibold text-[#15523d]">{metric.label}</p>
                <div className="mt-2 flex items-end justify-between">
                  <strong className="text-3xl font-semibold tracking-normal">{metric.value}</strong>
                  <span className="border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    {metric.note}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="min-w-0 space-y-4">
            <div className="border border-slate-400 bg-white p-4">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Bell className="h-5 w-5 text-[#15523d]" aria-hidden="true" />
                공지사항
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  "사후검토 입력 마감 D-3 기준 적용",
                  "위험요인 등록 양식 표준화",
                  "주간보고 반영 항목 자동 분류",
                ].map((item) => (
                  <div key={item} className="border-b border-slate-100 pb-3 last:border-b-0">
                    <p className="font-medium">{item}</p>
                    <p className="mt-1 text-xs text-slate-500">2026-07-03</p>
                  </div>
                ))}
              </div>
            </div>

            <section
              data-testid="saved-service-panel"
              className="border border-slate-400 bg-white p-4"
            >
              <div className="flex items-center gap-2 text-base font-semibold">
                <Database className="h-5 w-5 text-[#15523d]" aria-hidden="true" />
                저장 상태
              </div>
              <p className="mt-4 text-sm font-semibold">{config.savedTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                저장된 시연 항목 {state.savedCount}건. 내보낸 조치 묶음은 공개 데모 저장소에 실제로 보관된다.
              </p>
              <SavedArtifactList artifacts={state.savedArtifacts} />
            </section>
          </aside>

          <div className="min-w-0 space-y-5">
            <section className="min-w-0 border border-slate-400 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">회의·훈련 요약 작성</h2>
                  <p className="mt-1 text-sm text-slate-600">회의록과 훈련 사후검토를 주간보고 항목으로 정리합니다.</p>
                </div>
                <div className="w-full md:w-80">
                  <ModeButtons config={config} mode={mode} setMode={setMode} tone="slate" />
                </div>
              </div>
              <p data-testid="after-action-mode-description" className="mt-3 text-sm leading-6 text-slate-600">
                {modeCopy.description}
              </p>
              <div {...publicDemoTourTarget("after-action-source")}>
                <label htmlFor="afterAction-example" className="mt-5 block text-sm font-semibold">예시 입력</label>
                <select
                  id="afterAction-example"
                  aria-label="예시 입력"
                  value={state.selectedExampleId}
                  onChange={(event) => state.selectExample(event.target.value)}
                  className="mt-2 h-10 w-full border border-slate-400 bg-white px-3 text-sm"
                >
                  {state.examples.map((example) => (
                    <option key={example.id} value={example.id}>{example.label}</option>
                  ))}
                </select>
                <label htmlFor="afterAction-source" className="mt-5 block text-sm font-semibold">
                  {config.inputLabel}
                </label>
                <p className="mt-1 text-xs leading-5 text-slate-500">{modeCopy.inputHint}</p>
                <textarea
                  id="afterAction-source"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  className="mt-2 min-h-32 w-full resize-y border border-slate-400 bg-white p-3 text-sm leading-6 outline-none focus:border-[#15523d]"
                />
                <p className="mt-2 text-xs leading-5 text-amber-700">
                  입력은 Gemini로 전송됩니다. 실제 개인정보·군번·좌표·작전정보는 입력하지 마세요. 탐지 시 전송을 차단합니다.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2" {...publicDemoTourTarget("after-action-generate")}>
                <PrimaryActionButton
                  label={state.pendingAction === config.primaryAction ? "생성 중" : modeCopy.cta}
                  onClick={state.runPrimaryAction}
                  tone="green"
                  disabled={Boolean(state.pendingAction)}
                />
                <SecondaryActionButton
                  label={state.pendingAction === config.secondaryAction ? "내보내는 중" : config.secondaryAction}
                  onClick={state.runSecondaryAction}
                  tone="green"
                  disabled={Boolean(state.pendingAction) || !state.hasResult}
                />
              </div>
              {state.error ? <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
            </section>

            {!state.hasResult ? (
              <section className="min-w-0 border border-dashed border-slate-400 bg-slate-50 p-5 text-sm text-slate-600">
                요약을 생성하면 보고자료 상세보기가 여기에 표시됩니다.
              </section>
            ) : null}
            <TypewrittenDemoResult state={state}>
              {(visibleResult, complete, skip) => <article
                data-testid="demo-result-panel"
                hidden={!state.hasResult}
                className="min-w-0 border border-slate-400 bg-white p-5"
                {...publicDemoTourTarget("after-action-result")}
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#15523d]">보고자료 상세보기</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-normal">{visibleResult.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{generationLabel(state.result.model)}</p>
                  </div>
                  <div className="flex items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    {state.copied ? "내보냄/저장됨" : state.pendingAction || "검토대기"}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700">{visibleResult.summary}</p>
                {mode === "actions" && visibleResult.workItems.length > 0 ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {visibleResult.workItems.map((item, index) => (
                      <div
                        key={`${state.result.workItems[index]?.title}-${index}`}
                        className="flex items-center justify-between border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">담당: {item.owner}</p>
                          {item.dueDate ? <p className="mt-1 text-xs text-slate-500">마감: {item.dueDate}</p> : null}
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold ${riskTone[item.risk]}`}>
                          {riskLabel[item.risk]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <AfterActionResultSections mode={mode} sections={visibleResult.sections} />
                {!complete && /^gemini(?:-|$)/i.test(state.result.model) ? <button type="button" onClick={skip} className="mt-4 text-xs font-semibold text-[#15523d] underline">결과 바로 보기</button> : null}
              </article>}
            </TypewrittenDemoResult>

            <section className="min-w-0 border border-slate-400 bg-white p-5">
              <div className="flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="h-5 w-5 text-[#15523d]" aria-hidden="true" />
                조치사항 목록
              </div>
              <div className="mt-4 overflow-x-auto border border-slate-300">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[minmax(240px,1fr)_140px_110px_100px_100px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                    <span>조치사항</span>
                    <span>담당부서</span>
                    <span>마감일</span>
                    <span>상태</span>
                    <span>위험도</span>
                  </div>
                  {state.result.workItems.map((item) => (
                    <div
                      key={item.title}
                      className="grid grid-cols-[minmax(240px,1fr)_140px_110px_100px_100px] border-t border-slate-200 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-slate-600">{item.owner}</span>
                      <span className="text-slate-600">{item.dueDate || "-"}</span>
                      <span className="text-slate-600">{item.status}</span>
                      <span className={`w-fit px-2 py-1 text-xs font-semibold ${riskTone[item.risk]}`}>
                        {riskLabel[item.risk]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
