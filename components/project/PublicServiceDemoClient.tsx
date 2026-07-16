"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Database,
  FileCheck2,
  FileSearch,
  FileText,
  Filter,
  GitBranch,
  Home,
  LayoutDashboard,
  Menu,
  RefreshCcw,
  Save,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { PublicDemoHeader } from "@/components/project/PublicDemoHeader";

export type PublicServiceDemoVariant = "opsRadar" | "adminDoc" | "afterAction";

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
  resultTitle: string;
  resultLead: string;
  resultSections: ResultSection[];
  workItems: WorkItem[];
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
  opsRadar: {
    title: "작전 과업 병목관리",
    subtitle: "부서별 과업, 병목, 위험도를 한 화면에서 점검하는 공개 샘플 화면",
    routeLabel: "과업상황",
    icon: BarChart3,
    primaryAction: "재계산",
    secondaryAction: "화면 고정",
    inputLabel: "상황 메모",
    defaultInput:
      "장비 점검표 2건이 지연되고 야간 통신 점검 인원 배치가 미확정이다. 군수반은 예비 배터리 수량을 재확인하고 작전계획반은 우천 시 대체 일정을 정리한다.",
    modes: [
      { id: "risk", label: "위험도" },
      { id: "owner", label: "담당" },
      { id: "timeline", label: "일정" },
    ],
    metrics: [
      {
        label: "고위험",
        value: "2",
        note: "검토 필요",
        tone: "border-rose-200 bg-rose-50 text-rose-900",
      },
      {
        label: "지연과업",
        value: "4",
        note: "소유자 확인",
        tone: "border-amber-200 bg-amber-50 text-amber-900",
      },
      {
        label: "보고가능",
        value: "11",
        note: "보고 가능",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      },
    ],
    resultTitle: "병목 재계산 결과",
    resultLead:
      "지연 원인은 자료 미제출과 승인 대기 두 갈래로 분리된다. 보고 전에는 장비 점검표와 안전 통제 인원 배치가 먼저 닫혀야 한다.",
    resultSections: [
      {
        label: "우선 조치",
        body: "군수반 점검표 회수, 작전계획반 대체 일정 작성, 참모부 위험문구 검토를 같은 마감선에 묶는다.",
      },
      {
        label: "노드 연결",
        body: "점검표 취합 노드는 야간 통신 점검과 주간상황보고 노드 모두의 선행조건으로 표시한다.",
      },
    ],
    workItems: [
      { title: "점검표 미제출 회수", owner: "군수반", status: "지연", risk: "high" },
      { title: "야간 통신 안전 통제", owner: "작전계획반", status: "검토", risk: "high" },
      { title: "주간상황보고 초안", owner: "참모부", status: "보고가능", risk: "medium" },
      { title: "대체 일정 후보", owner: "교육훈련반", status: "초안", risk: "low" },
    ],
    evidence: [
      "실명, 군번, 실제 부대명 없이 예시 데이터만 표시",
      "그래프 병목 판단은 브라우저 내부 샘플 규칙으로 계산",
      "인증 프로젝트 데이터와 분리된 공개 캡처용 화면",
    ],
    savedTitle: "상황판 스냅샷",
  },
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
    resultTitle: "행정문서 초안",
    resultLead:
      "입력 메모를 목적, 주요 경과, 미결사항, 조치계획, 보안 확인으로 정리했다. 실제 제출 전에는 기관명과 담당자 값을 최종 확인해야 한다.",
    resultSections: [
      {
        label: "보고 목적",
        body: "합동 점검 준비 현황과 지연 항목을 지휘 계통에 간결히 공유한다.",
      },
      {
        label: "조치 계획",
        body: "미제출 점검표 회수, 안전 통제 인원 확정, 우천 시 대체 일정 검토를 순차 진행한다.",
      },
      {
        label: "보안 확인",
        body: "현재 화면은 예시 데이터이며 실명, 연락처, 실제 위치, 세부 작전계획을 포함하지 않는다.",
      },
    ],
    workItems: [
      { title: "보고 목적 문단", owner: "자동작성", status: "생성", risk: "low" },
      { title: "미결사항 표", owner: "참모 검토", status: "검토", risk: "medium" },
      { title: "보안 문구", owner: "보안 담당", status: "확인", risk: "low" },
      { title: "결재 요지", owner: "문서 담당", status: "초안", risk: "medium" },
    ],
    evidence: [
      "공개 페이지에서 결재 문서 흐름을 직접 조작 가능",
      "출력은 샘플 텍스트이며 외부 생성 API 호출 없이 결정적 생성",
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
    resultTitle: "사후조치 요약",
    resultLead:
      "사후검토의 개선사항을 주간상황보고용 실행 항목으로 변환했다. 입력 마감과 위험요인 등록 양식을 표준화하는 것이 다음 주 핵심 과업이다.",
    resultSections: [
      {
        label: "유지할 점",
        body: "과업 그래프를 통해 지연 위치와 담당 부서를 빠르게 확인한 점은 유지한다.",
      },
      {
        label: "개선할 점",
        body: "점검표 제출 마감과 위험요인 입력 기준을 사전에 고정해 부서별 편차를 줄인다.",
      },
      {
        label: "주간보고 반영",
        body: "미결 조치 6건은 다음 주 보고의 진행 항목으로 자동 편성한다.",
      },
    ],
    workItems: [
      { title: "D-3 입력 마감 고정", owner: "교육훈련반", status: "조치", risk: "medium" },
      { title: "위험요인 등록 양식", owner: "작전계획반", status: "초안", risk: "high" },
      { title: "사후검토 결과 공유", owner: "참모부", status: "확인", risk: "low" },
      { title: "다음 주 보고 반영", owner: "보고 담당", status: "대기", risk: "medium" },
    ],
    evidence: [
      "사후검토, 회의록, 주간보고가 한 화면에 연결됨",
      "민감 실제 훈련명 없이 예시 일정과 부서명만 사용",
      "저장 동작은 브라우저 상태 기반의 캡처용 시뮬레이션",
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

function ResultSectionBlock({ section }: { section: ResultSection }) {
  return (
    <section className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{section.body}</p>
    </section>
  );
}

function fallbackResultFromConfig(config: DemoConfig): LiveDemoResult {
  const markdownSections = config.resultSections
    .map((section) => `## ${section.label}\n${section.body}`)
    .join("\n\n");
  const actions = config.workItems.map((item) => `${item.owner}: ${item.title}`);

  return {
    title: config.resultTitle,
    summary: config.resultLead,
    sections: config.resultSections,
    actions,
    security: config.evidence.map((item) => ({ label: "시연 조건", status: "pass", note: item })),
    metrics: config.metrics.map(({ label, value, note }) => ({ label, value, note })),
    workItems: config.workItems,
    markdown: `# ${config.resultTitle}\n\n${config.resultLead}\n\n${markdownSections}\n\n## 처리항목\n${actions.map((action) => `- ${action}`).join("\n")}`,
    model: "initial-demo-state",
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
  result: LiveDemoResult;
  displayMetrics: Metric[];
  savedArtifacts: SavedDemoArtifact[];
  savedCount: number;
  copied: boolean;
  pendingAction: string;
  error: string;
  sourceWordCount: number;
  generatedLead: string;
  runPrimaryAction: () => void;
  runSecondaryAction: () => void;
}

export function PublicServiceDemoClient({
  variant,
}: {
  variant: PublicServiceDemoVariant;
}) {
  const config = demoConfigs[variant];
  const [mode, setMode] = useState(config.modes[0]?.id ?? "default");
  const [sourceText, setSourceText] = useState(config.defaultInput);
  const [result, setResult] = useState<LiveDemoResult>(() => fallbackResultFromConfig(config));
  const [savedArtifacts, setSavedArtifacts] = useState<SavedDemoArtifact[]>([]);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");

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
    const liveMetrics = result.metrics.length > 0 ? result.metrics : config.metrics;
    return liveMetrics.slice(0, 3).map((metric, index) => ({
      ...config.metrics[index % config.metrics.length],
      ...metric,
      tone: config.metrics[index % config.metrics.length].tone,
    }));
  }, [config.metrics, result.metrics]);

  async function runPrimaryAction() {
    if (pendingAction) return;

    setCopied(false);
    setError("");
    setPendingAction(config.primaryAction);

    try {
      const response = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: variant, mode, sourceText }),
      });
      const body = await response.json();
      if (!response.ok || !body.result) {
        throw new Error(body.error || "생성에 실패했습니다.");
      }
      setResult(body.result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "생성에 실패했습니다.");
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
    if (pendingAction) return;

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
    setMode,
    sourceText,
    setSourceText,
    result,
    displayMetrics,
    savedArtifacts,
    savedCount: savedArtifacts.length,
    copied,
    pendingAction,
    error,
    sourceWordCount,
    generatedLead: result.summary,
    runPrimaryAction,
    runSecondaryAction,
  };

  if (variant === "adminDoc") {
    return <AdminDocumentPortal state={state} />;
  }

  if (variant === "afterAction") {
    return <AfterActionBoard state={state} />;
  }

  return <OpsRadarConsole state={state} />;
}

function OpsRadarConsole({ state }: { state: DemoState }) {
  const { config, mode, setMode, sourceText, setSourceText } = state;

  return (
    <main className="min-h-screen bg-[#e8edf2] text-slate-900">
      <PublicDemoHeader variant="opsRadar" title={config.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
        <aside className="border border-slate-400 bg-white">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-900">작전 메뉴</span>
            <Menu className="h-4 w-4 text-slate-600" aria-hidden="true" />
          </div>
          <div className="divide-y divide-slate-200 text-sm">
            {["실시간 병목", "부서별 과업", "승인 대기", "보고 스냅샷"].map((item, index) => (
              <div
                key={item}
                className={`flex items-center justify-between px-3 py-2 ${
                  index === 0 ? "bg-[#dce8f2] font-semibold text-[#173f61]" : "text-slate-700"
                }`}
              >
                <span>{item}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="m-3 border border-amber-500 bg-[#fff8e5] p-3 text-sm text-slate-800">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              샘플 데이터
            </div>
            <p className="mt-2 leading-6">
              실제 작전망, 위치, 부대명과 분리된 공개 캡처용 상황판입니다.
            </p>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="border border-slate-400 bg-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="px-4 pt-4">
                <p className="text-sm font-semibold text-[#173f61]">작전상황판 / 공개 샘플</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                  합동작전 병목상황판
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{config.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2 px-4 text-xs lg:pb-4">
                <span className="border border-slate-400 bg-slate-100 px-3 py-2 font-semibold text-slate-800">
                  공개 샘플망
                </span>
                <span className="border border-slate-400 bg-white px-3 py-2 font-semibold text-slate-800">
                  {state.result.model}
                </span>
              </div>
            </div>

            <div className="mt-4 grid border-t border-slate-300 md:grid-cols-3">
              {state.displayMetrics.map((metric) => (
                <div key={metric.label} className="border-b border-slate-300 p-4 md:border-r md:last:border-r-0">
                  <p className="text-sm font-semibold text-slate-700">{metric.label}</p>
                  <div className="mt-2 flex items-end justify-between">
                    <strong className="text-3xl font-semibold tracking-normal text-slate-950">
                      {metric.value}
                    </strong>
                    <span className="border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {metric.note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="border border-slate-400 bg-white p-4 text-slate-950">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">상황 입력 및 재계산</h2>
                <Filter className="h-5 w-5 text-slate-500" aria-hidden="true" />
              </div>
              <div className="mt-4">
                <ModeButtons config={config} mode={mode} setMode={setMode} tone="slate" disabled={Boolean(state.pendingAction)} />
              </div>
              <label htmlFor="opsRadar-source" className="mt-5 block text-sm font-semibold">
                {config.inputLabel}
              </label>
              <textarea
                id="opsRadar-source"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                className="mt-2 min-h-40 w-full resize-y border border-slate-400 bg-white p-3 text-sm leading-6 outline-none focus:border-[#173f61]"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryActionButton
                  label={state.pendingAction === config.primaryAction ? "처리 중" : config.primaryAction}
                  onClick={state.runPrimaryAction}
                  tone="blue"
                  disabled={Boolean(state.pendingAction)}
                />
                <SecondaryActionButton
                  label={state.pendingAction === config.secondaryAction ? "저장 중" : config.secondaryAction}
                  onClick={state.runSecondaryAction}
                  tone="blue"
                  disabled={Boolean(state.pendingAction)}
                />
              </div>
              {state.error ? <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
            </section>

            <section
              data-testid="demo-result-panel"
              className="border border-slate-400 bg-white"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-300 bg-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#173f61]">분석 결과</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
                    {state.result.title}
                  </h2>
                </div>
                <span className="border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {state.copied ? "저장됨" : state.pendingAction || "검토대기"}
                </span>
              </div>
              <p className="px-4 py-3 text-sm leading-6 text-slate-700">{state.generatedLead}</p>
              <div className="grid border-t border-slate-300 md:grid-cols-2">
                {state.result.sections.map((section) => (
                  <div key={section.label} className="border-b border-slate-300 p-4 md:border-r md:last:border-r-0">
                    <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{section.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="border border-slate-400 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#173f61]">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                선행조건 노드
              </div>
              <div className="mt-3 divide-y divide-slate-300 border border-slate-300">
                {state.result.workItems.map((item) => (
                  <div key={item.title} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.owner} / {item.status}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold ${riskTone[item.risk]}`}>
                      {riskLabel[item.risk]}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section
              data-testid="saved-service-panel"
              className="border border-slate-400 bg-white p-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#173f61]">
                <Save className="h-4 w-4" aria-hidden="true" />
                저장 상태
              </div>
              <div className="mt-4 border border-slate-300 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">{config.savedTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  저장된 시연 항목 {state.savedCount}건. 공개 데모 저장소에 실제로 보관된다.
                </p>
                <SavedArtifactList artifacts={state.savedArtifacts} />
              </div>
              <div className="mt-4 grid grid-cols-[auto_1fr] gap-3 text-sm text-slate-700">
                <GitBranch className="h-4 w-4 text-[#173f61]" aria-hidden="true" />
                <span>선행노드 미리보기</span>
                <Archive className="h-4 w-4 text-[#173f61]" aria-hidden="true" />
                <span>보고 초안 보관</span>
                <FileCheck2 className="h-4 w-4 text-[#173f61]" aria-hidden="true" />
                <span>별첨 증빙 화면</span>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminDocumentPortal({ state }: { state: DemoState }) {
  const { config, mode, setMode, sourceText, setSourceText } = state;

  return (
    <main className="min-h-screen bg-[#eef2f5] text-slate-950">
      <PublicDemoHeader variant="adminDoc" title={config.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[250px_1fr] lg:px-8">
        <aside className="border border-slate-400 bg-white">
          <div className="border-b border-slate-300 bg-[#174f86] px-4 py-3 text-sm font-semibold text-white">
            행정서비스
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {["작성안내", "보고서식", "결재요지", "보안검토", "나의 임시문서"].map((item, index) => (
              <div
                key={item}
                className={`flex items-center justify-between px-4 py-3 ${
                  index === 1 ? "bg-[#e5eef7] font-semibold text-[#174f86]" : "text-slate-700"
                }`}
              >
                <span>{item}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </div>
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

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="min-w-0 border border-slate-400 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">문서작성 입력</h2>
                <FileSearch className="h-5 w-5 text-[#174f86]" aria-hidden="true" />
              </div>
              <div className="mt-4">
                <ModeButtons config={config} mode={mode} setMode={setMode} tone="blue" disabled={Boolean(state.pendingAction)} />
              </div>
              <label htmlFor="adminDoc-source" className="mt-5 block text-sm font-semibold">
                {config.inputLabel}
              </label>
              <textarea
                id="adminDoc-source"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                className="mt-2 min-h-44 w-full resize-y border border-slate-400 bg-white p-3 text-sm leading-6 outline-none focus:border-[#174f86]"
              />
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <span className="border border-slate-300 bg-slate-50 px-3 py-2">단어 {state.sourceWordCount}</span>
                <span className="border border-slate-300 bg-slate-50 px-3 py-2">{state.result.model}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
                  disabled={Boolean(state.pendingAction)}
                />
              </div>
              {state.error ? <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
            </section>

            <article
              data-testid="demo-result-panel"
              className="border border-slate-400 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-semibold text-[#174f86]">전자문서 미리보기</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-normal">{state.result.title}</h2>
                </div>
                <span className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {state.copied ? "복사/저장됨" : state.pendingAction || "작성중"}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{state.generatedLead}</p>
              <div className="mt-5 space-y-4">
                {state.result.sections.map((section) => (
                  <ResultSectionBlock key={section.label} section={section} />
                ))}
              </div>
            </article>
          </div>

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

function AfterActionBoard({ state }: { state: DemoState }) {
  const { config, mode, setMode, sourceText, setSourceText } = state;

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
                  <ModeButtons config={config} mode={mode} setMode={setMode} tone="slate" disabled={Boolean(state.pendingAction)} />
                </div>
              </div>
              <label htmlFor="afterAction-source" className="mt-5 block text-sm font-semibold">
                {config.inputLabel}
              </label>
              <textarea
                id="afterAction-source"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                className="mt-2 min-h-32 w-full resize-y border border-slate-400 bg-white p-3 text-sm leading-6 outline-none focus:border-[#15523d]"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryActionButton
                  label={state.pendingAction === config.primaryAction ? "생성 중" : config.primaryAction}
                  onClick={state.runPrimaryAction}
                  tone="green"
                  disabled={Boolean(state.pendingAction)}
                />
                <SecondaryActionButton
                  label={state.pendingAction === config.secondaryAction ? "내보내는 중" : config.secondaryAction}
                  onClick={state.runSecondaryAction}
                  tone="green"
                  disabled={Boolean(state.pendingAction)}
                />
              </div>
              {state.error ? <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
            </section>

            <article
              data-testid="demo-result-panel"
              className="min-w-0 border border-slate-400 bg-white p-5"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#15523d]">보고자료 상세보기</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-normal">{state.result.title}</h2>
                </div>
                <div className="flex items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  {state.copied ? "내보냄/저장됨" : state.pendingAction || "검토대기"}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{state.generatedLead}</p>
              <div className="mt-5 border border-slate-300">
                {state.result.sections.map((section) => (
                  <section key={section.label} className="grid border-t border-slate-300 first:border-t-0 md:grid-cols-[160px_1fr]">
                    <h3 className="bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950">{section.label}</h3>
                    <p className="px-3 py-3 text-sm leading-6 text-slate-700">{section.body}</p>
                  </section>
                ))}
              </div>
            </article>

            <section className="min-w-0 border border-slate-400 bg-white p-5">
              <div className="flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="h-5 w-5 text-[#15523d]" aria-hidden="true" />
                조치사항 목록
              </div>
              <div className="mt-4 overflow-x-auto border border-slate-300">
                <div className="min-w-[620px]">
                  <div className="grid grid-cols-[minmax(240px,1fr)_140px_100px_100px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                    <span>조치사항</span>
                    <span>담당부서</span>
                    <span>상태</span>
                    <span>위험도</span>
                  </div>
                  {state.result.workItems.map((item) => (
                    <div
                      key={item.title}
                      className="grid grid-cols-[minmax(240px,1fr)_140px_100px_100px] border-t border-slate-200 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-slate-600">{item.owner}</span>
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
