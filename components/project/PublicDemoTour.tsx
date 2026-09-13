"use client";

import { useEffect, useRef, useState } from "react";

export const PUBLIC_DEMO_TOUR_STORAGE_KEY = "node-public-demo-tour-v1";

export type PublicDemoTourPageId = "militaryAi" | "opsRadar" | "adminDoc" | "afterAction";
export type PublicDemoTourDirection = "forward" | "backward";
export type PublicDemoTourActionId = "meetingSummary" | "generateAi" | "securityScan" | "evaluate" | "approval" | "security" | "weekly" | "actions";
export type PublicDemoTourTargetId =
  | "military-ai-tools"
  | "military-ai-input"
  | "military-ai-generate"
  | "military-ai-output"
  | "ops-radar-tasks"
  | "ops-radar-evaluate"
  | "ops-radar-report"
  | "admin-doc-type"
  | "admin-doc-generate"
  | "admin-doc-result"
  | "after-action-mode"
  | "after-action-source"
  | "after-action-generate"
  | "after-action-result";

export type PublicDemoTourStep = {
  targetId: PublicDemoTourTargetId;
  title: string;
  description: string;
  actionId?: PublicDemoTourActionId;
  completionSelector?: string;
};

export type PublicDemoTourPage = {
  id: PublicDemoTourPageId;
  label: string;
  href: string;
  steps: readonly PublicDemoTourStep[];
};

export type PublicDemoTourState = {
  status: "active" | "dismissed" | "completed";
  pageIndex: number;
  stepIndex: number;
  direction: PublicDemoTourDirection;
  aiGenerated?: boolean;
  aiGenerationComplete?: boolean;
};

export const PUBLIC_DEMO_TOUR_PAGES: readonly PublicDemoTourPage[] = [
  {
    id: "militaryAi",
    label: "문서지원",
    href: "/military-ai-demo",
    steps: [
      { targetId: "military-ai-tools", actionId: "meetingSummary", completionSelector: '[data-tour-action="meetingSummary"][aria-pressed="true"]', title: "회의 작업 선택", description: "회의 버튼을 실제로 눌러 입력 안내와 실행 버튼이 바뀌는 모습을 보여 줍니다." },
      { targetId: "military-ai-input", title: "작성 조건 입력", description: "문서 작성에 필요한 조건과 예시를 확인합니다." },
      { targetId: "military-ai-generate", actionId: "generateAi", completionSelector: '[data-tour-ai-result="complete"]', title: "AI 회의록 생성", description: "안전한 합성 예시로 실제 Gemini 생성 경로를 실행합니다. 중단되거나 실패하면 표시된 생성 버튼을 다시 눌러 재시도하세요." },
      { targetId: "military-ai-tools", actionId: "securityScan", completionSelector: '[data-tour-action="securityScan"][aria-pressed="true"]', title: "보안검토 전환", description: "보안 버튼을 실제로 눌러 전용 입력 안내와 점검 화면으로 전환합니다." },
    ],
  },
  {
    id: "opsRadar",
    label: "과업상황",
    href: "/ops-radar-demo",
    steps: [
      { targetId: "ops-radar-tasks", title: "과업 현황", description: "과업과 선후행 관계를 한곳에서 확인합니다." },
      { targetId: "ops-radar-evaluate", actionId: "evaluate", completionSelector: '[data-tour-action="evaluate"][aria-pressed="true"]', title: "병목 평가 실행", description: "업무 평가 실행 버튼을 실제로 눌러 병목, 영향 업무, 보고 패널을 표시합니다." },

    ],
  },
  {
    id: "adminDoc",
    label: "행정문서",
    href: "/admin-doc-demo",
    steps: [
      { targetId: "admin-doc-type", actionId: "approval", completionSelector: '[data-tour-action="approval"][aria-pressed="true"]', title: "결재요지 선택", description: "결재요지 메뉴를 실제로 눌러 입력 안내와 미리보기 계약을 바꿉니다." },
      { targetId: "admin-doc-type", actionId: "security", completionSelector: '[data-tour-action="security"][aria-pressed="true"]', title: "보안검토 선택", description: "보안검토 메뉴를 실제로 눌러 마스킹 점검 화면으로 전환합니다. 초안 생성은 사용자가 직접 실행합니다." },

    ],
  },
  {
    id: "afterAction",
    label: "사후조치",
    href: "/after-action-demo",
    steps: [
      { targetId: "after-action-mode", actionId: "weekly", completionSelector: '[data-tour-action="weekly"][aria-pressed="true"]', title: "주간보고 전환", description: "주간 버튼을 실제로 눌러 주간보고 입력 안내와 실행 버튼을 표시합니다." },
      { targetId: "after-action-mode", actionId: "actions", completionSelector: '[data-tour-action="actions"][aria-pressed="true"]', title: "조치 목록 전환", description: "조치 버튼을 실제로 눌러 담당·기한 중심의 조치 목록 화면으로 전환합니다. 생성 API는 실행하지 않습니다." },

    ],
  },
] as const;

export function publicDemoTourTarget(targetId: PublicDemoTourTargetId): { "data-tour-id": PublicDemoTourTargetId } {
  return { "data-tour-id": targetId };
}

function readState(): PublicDemoTourState | null {
  try {
    const value = sessionStorage.getItem(PUBLIC_DEMO_TOUR_STORAGE_KEY);
    if (!value) return null;
    const state = JSON.parse(value) as Partial<PublicDemoTourState>;
    if (
      !["active", "dismissed", "completed"].includes(state.status ?? "") ||
      !Number.isInteger(state.pageIndex) ||
      !Number.isInteger(state.stepIndex) ||
      (state.direction !== "forward" && state.direction !== "backward")
    ) return null;
    const pageIndex = state.pageIndex as number;
    const stepIndex = state.stepIndex as number;
    if (
      pageIndex < 0 ||
      pageIndex >= PUBLIC_DEMO_TOUR_PAGES.length ||
      stepIndex < 0 ||
      stepIndex >= PUBLIC_DEMO_TOUR_PAGES[pageIndex].steps.length
    ) return null;
    return state as PublicDemoTourState;
  } catch {
    return null;
  }
}

function writeState(state: PublicDemoTourState) {
  try {
    sessionStorage.setItem(PUBLIC_DEMO_TOUR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The tutorial remains usable when storage is unavailable.
  }
}

export function PublicDemoTour({ currentPage }: { currentPage: PublicDemoTourPageId }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const readyToAdvanceRef = useRef(true);
  const [view, setView] = useState<"loading" | "welcome" | "tour" | "closed">("loading");
  const [tourState, setTourState] = useState<PublicDemoTourState | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [actionRect, setActionRect] = useState<DOMRect | null>(null);
  const [clickPoint, setClickPoint] = useState<{ left: number; top: number } | null>(null);
  const [actionPending, setActionPending] = useState(false);

  function setAdvanceReady(value: boolean) {
    readyToAdvanceRef.current = value;
  }

  function close(status: "dismissed" | "completed") {
    const persisted = readState();
    const generationAction = document.querySelector<HTMLButtonElement>('button[data-tour-action="generateAi"]');
    generationAction?.removeAttribute("data-tour-trigger");
    if (generationAction && persisted?.aiGenerationComplete !== true) generationAction.disabled = false;
    const state: PublicDemoTourState = {
      status,
      pageIndex: tourState?.pageIndex ?? 0,
      stepIndex: tourState?.stepIndex ?? 0,
      direction: "forward",
      aiGenerated: persisted?.aiGenerated ?? tourState?.aiGenerated,
      aiGenerationComplete: persisted?.aiGenerationComplete ?? tourState?.aiGenerationComplete,
    };
    writeState(state);
    setView("closed");
    setTourState(state);
    setTargetRect(null);
    setActionRect(null);
    setClickPoint(null);
    setActionPending(false);
  }

  function activate(candidate: PublicDemoTourState) {
    const previousGenerationAction = document.querySelector<HTMLButtonElement>('button[data-tour-action="generateAi"]');
    previousGenerationAction?.removeAttribute("data-tour-trigger");
    if (previousGenerationAction && candidate.aiGenerationComplete !== true) previousGenerationAction.disabled = false;
    setActionPending(false);
    let pageIndex = candidate.pageIndex;
    let stepIndex = candidate.stepIndex;
    const direction = candidate.direction;
    const aiGenerated = candidate.aiGenerated === true;
    const aiGenerationComplete = candidate.aiGenerationComplete === true;

    while (pageIndex >= 0 && pageIndex < PUBLIC_DEMO_TOUR_PAGES.length) {
      const page = PUBLIC_DEMO_TOUR_PAGES[pageIndex];
      if (page.id !== currentPage) {
        const nextState = { status: "active", pageIndex, stepIndex, direction, aiGenerated, aiGenerationComplete } as const;
        writeState(nextState);
        window.location.assign(page.href);
        return;
      }

      const end = direction === "forward" ? page.steps.length : -1;
      for (let index = stepIndex; index !== end; index += direction === "forward" ? 1 : -1) {
        const step = page.steps[index];
        if (step.actionId === "generateAi" && aiGenerationComplete) {
          const action = document.querySelector<HTMLButtonElement>('button[data-tour-action="generateAi"]');
          if (action) action.disabled = true;
          continue;
        }
        const target = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
        if (!target) continue;
        target.scrollIntoView({ block: "center", behavior: "auto" });
        if (step.actionId) {
          const action = document.querySelector<HTMLButtonElement>(`button[data-tour-action="${step.actionId}"]`);
          if (!action || action.disabled) return;
          if (step.actionId === "generateAi") action.dataset.tourTrigger = "true";
          const rect = action.getBoundingClientRect();
          setActionRect(rect);
          setClickPoint({ left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 });
        } else {
          setActionRect(null);
          setClickPoint(null);
        }
        const nextState = { status: "active", pageIndex, stepIndex: index, direction, aiGenerated, aiGenerationComplete } as const;
        writeState(nextState);
        setTourState(nextState);
        setAdvanceReady(!step.actionId);
        setTargetRect(target.getBoundingClientRect());
        setView("tour");
        return;
      }

      pageIndex += direction === "forward" ? 1 : -1;
      if (pageIndex < 0 || pageIndex >= PUBLIC_DEMO_TOUR_PAGES.length) {
        close(direction === "forward" ? "completed" : "dismissed");
        return;
      }
      stepIndex = direction === "forward" ? 0 : PUBLIC_DEMO_TOUR_PAGES[pageIndex].steps.length - 1;
    }
  }

  function start() {
    const previous = readState();
    activate({
      status: "active",
      pageIndex: 0,
      stepIndex: 0,
      direction: "forward",
      aiGenerated: previous?.aiGenerated,
      aiGenerationComplete: previous?.aiGenerationComplete,
    });
  }

  function move(direction: PublicDemoTourDirection, bypass = false) {
    if (!tourState || (!bypass && !readyToAdvanceRef.current)) return;
    const page = PUBLIC_DEMO_TOUR_PAGES[tourState.pageIndex];
    const offset = direction === "forward" ? 1 : -1;
    let pageIndex = tourState.pageIndex;
    let stepIndex = tourState.stepIndex + offset;

    if (stepIndex >= page.steps.length || stepIndex < 0) {
      pageIndex += offset;
      if (pageIndex < 0) return;
      if (pageIndex >= PUBLIC_DEMO_TOUR_PAGES.length) {
        close("completed");
        return;
      }
      stepIndex = direction === "forward" ? 0 : PUBLIC_DEMO_TOUR_PAGES[pageIndex].steps.length - 1;
    }

    activate({
      status: "active",
      pageIndex,
      stepIndex,
      direction,
      aiGenerated: tourState.aiGenerated,
      aiGenerationComplete: tourState.aiGenerationComplete,
    });
  }

  function skip() {
    if (actionPending) return;
    document.querySelector<HTMLButtonElement>('button[data-tour-action="generateAi"]')?.removeAttribute("data-tour-trigger");
    move("forward", true);
  }

  useEffect(() => {
    const stored = readState();
    const task = window.requestAnimationFrame(() => {
      if (stored?.aiGenerationComplete) {
        const action = document.querySelector<HTMLButtonElement>('button[data-tour-action="generateAi"]');
        if (action) action.disabled = true;
      }
      if (!stored) setView("welcome");
      else if (stored.status === "active") activate(stored);
      else setView("closed");
    });
    return () => window.cancelAnimationFrame(task);
    // The initial session state is intentionally read once per route hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (view === "welcome" || view === "tour") {
      restoreFocusRef.current ??= document.activeElement as HTMLElement | null;
      if (!dialog.open) dialog.show();
    } else if (dialog.open) {
      dialog.close();
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }
  }, [view]);

  useEffect(() => {
    if (view !== "tour" || !tourState) return;
    const activeStep = PUBLIC_DEMO_TOUR_PAGES[tourState.pageIndex].steps[tourState.stepIndex];
    const targetId = activeStep.targetId;
    const update = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
      if (target) setTargetRect(target.getBoundingClientRect());
      const action = activeStep.actionId && !actionPending
        ? document.querySelector<HTMLButtonElement>(`button[data-tour-action="${activeStep.actionId}"]`)
        : null;
      if (action) {
        const rect = action.getBoundingClientRect();
        setActionRect(rect);
        setClickPoint({ left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 });
      } else {
        setActionRect(null);
        setClickPoint(null);
      }
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [actionPending, tourState, view]);

  useEffect(() => {
    if (view !== "tour" || !tourState) return;
    const activeStep = PUBLIC_DEMO_TOUR_PAGES[tourState.pageIndex].steps[tourState.stepIndex];
    if (!activeStep.actionId) return;
    const action = document.querySelector<HTMLButtonElement>(`button[data-tour-action="${activeStep.actionId}"]`);
    if (!action) return;
    const completionSelector = activeStep.completionSelector;
    let timer: number | undefined;
    let actionClicked = false;
    let completionCleared = !completionSelector || !document.querySelector(completionSelector);
    const scheduleAdvance = (delay: number) => {
      timer = window.setTimeout(() => move("forward"), delay);
    };
    const handleAction = () => {
      actionClicked = true;
      setActionPending(true);
      setActionRect(null);
      setClickPoint(null);
      if (activeStep.actionId === "generateAi") {
        writeState({ ...tourState, aiGenerated: true });
        setAdvanceReady(false);
        return;
      }
      const complete = !completionSelector || Boolean(document.querySelector(completionSelector));
      setAdvanceReady(complete);
      if (complete) scheduleAdvance(1_200);
    };
    action.addEventListener("click", handleAction, true);

    if (!completionSelector) {
      return () => {
        action.removeEventListener("click", handleAction, true);
        if (timer) window.clearTimeout(timer);
      };
    }

    const observer = new MutationObserver(() => {
      if (!actionClicked) return;
      if (!document.querySelector(completionSelector)) {
        completionCleared = true;
        if (activeStep.actionId === "generateAi" && document.querySelector('[data-tour-ai-error="true"]')) {
          actionClicked = false;
          setActionPending(false);
          setAdvanceReady(false);
        }
        return;
      }
      if (!completionCleared) return;
      observer.disconnect();
      setAdvanceReady(true);
      if (activeStep.actionId !== "generateAi") {
        scheduleAdvance(1_200);
        return;
      }
      const generationAction = document.querySelector<HTMLButtonElement>('button[data-tour-action="generateAi"]');
      generationAction?.removeAttribute("data-tour-trigger");
      if (generationAction) generationAction.disabled = true;
      const completedState = { ...tourState, aiGenerated: true, aiGenerationComplete: true };
      writeState(completedState);
      timer = window.setTimeout(() => activate({ ...completedState, stepIndex: completedState.stepIndex + 1 }), 2_400);
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    return () => {
      observer.disconnect();
      action.removeEventListener("click", handleAction, true);
      if (timer) window.clearTimeout(timer);
    };
    // Restart observers only when the displayed step or persisted AI state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourState, view]);

  const page = tourState ? PUBLIC_DEMO_TOUR_PAGES[tourState.pageIndex] : null;
  const step = page && tourState ? page.steps[tourState.stepIndex] : null;
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const cardLeft = targetRect ? Math.min(Math.max(targetRect.left, 16), viewportWidth - 400) : 16;
  const cardTop = targetRect
    ? targetRect.top > viewportHeight * 0.58
      ? Math.min(Math.max(16, targetRect.top - 280), viewportHeight - 240)
      : Math.min(targetRect.bottom + 16, viewportHeight - 300)
    : 96;
  const cardStyle = { "--tour-left": `${cardLeft}px`, "--tour-top": `${cardTop}px` } as React.CSSProperties;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="border border-white/35 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        튜토리얼 다시 시작
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="public-demo-tour-title"
        aria-describedby="public-demo-tour-description"
        onCancel={(event) => {
          event.preventDefault();
          close("dismissed");
        }}
        className="pointer-events-none fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-visible bg-transparent p-0 text-slate-900"
      >
        {(view === "welcome" || view === "tour") && <span aria-hidden="true" className="fixed inset-0 bg-slate-950/20" />}
        {view === "tour" && targetRect && (
          <span
            aria-hidden="true"
            className="pointer-events-none fixed border-4 border-amber-400 bg-amber-200/10 shadow-[0_0_0_4px_rgba(15,23,42,0.35)]"
            style={{ left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12, height: targetRect.height + 12 }}
          />
        )}

        {view === "tour" && actionRect && (
          <span
            data-testid="tour-action-highlight"
            aria-hidden="true"
            className="pointer-events-none fixed z-10 rounded-lg border-4 border-slate-700 bg-slate-200/20 shadow-[0_0_0_5px_rgba(255,255,255,0.8)]"
            style={{ left: actionRect.left - 6, top: actionRect.top - 6, width: actionRect.width + 12, height: actionRect.height + 12 }}
          />
        )}

        {view === "tour" && clickPoint && (
          <span
            data-testid="tour-click-indicator"
            aria-hidden="true"
            className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-1/2"
            style={clickPoint}
          >
            <span className="absolute -inset-5 rounded-full border-2 border-slate-500/60 bg-slate-300/30 motion-safe:animate-ping" />
            <span className="relative block h-4 w-4 rounded-full border-2 border-white bg-slate-600/80 shadow-lg" />
          </span>
        )}

        {view === "welcome" && (
          <section className="pointer-events-auto fixed left-1/2 top-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 border border-slate-300 bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold text-blue-700">4개 공개 시연 둘러보기</p>
            <h2 id="public-demo-tour-title" className="mt-2 text-2xl font-bold">Node 공개 시연에 오신 것을 환영합니다</h2>
            <p id="public-demo-tour-description" className="mt-3 text-sm leading-6 text-slate-600">
              표시된 실제 버튼을 직접 눌러 기능 변화를 확인합니다. 원하지 않는 단계는 넘어갈 수 있습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => close("dismissed")} className="border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">나중에</button>
              <button type="button" autoFocus onClick={start} className="bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">시작</button>
            </div>
          </section>
        )}

        {view === "tour" && page && step && tourState && (
          <section
            style={cardStyle}
            className="pointer-events-auto fixed bottom-0 left-0 max-h-[calc(100dvh-1rem)] w-full overflow-y-auto border border-slate-300 bg-white p-5 shadow-2xl [top:auto] sm:bottom-auto sm:w-96 sm:[left:var(--tour-left)] sm:[top:var(--tour-top)]"
          >
            <p className="text-xs font-semibold text-blue-700">직접 체험 중 · 화면 {tourState.pageIndex + 1}/4 · 단계 {tourState.stepIndex + 1}/{page.steps.length}</p>
            <h2 id="public-demo-tour-title" className="mt-2 text-lg font-bold">{step.title}</h2>
            <p id="public-demo-tour-description" className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button type="button" disabled={actionPending} onClick={() => close("dismissed")} className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">종료</button>
              <div className="flex gap-2">
                <button type="button" disabled={actionPending || (tourState.pageIndex === 0 && tourState.stepIndex === 0)} onClick={() => move("backward", true)} className="border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">이전</button>
                <button type="button" autoFocus disabled={actionPending} onClick={skip} className="bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                  {tourState.pageIndex === PUBLIC_DEMO_TOUR_PAGES.length - 1 && tourState.stepIndex === page.steps.length - 1 ? "완료" : "넘어가기"}
                </button>
              </div>
            </div>
          </section>
        )}
        {view === "tour" && page && step && tourState && (
          <p className="sr-only" role="status" aria-live="polite">{page.label} 화면 {tourState.stepIndex + 1}단계. {step.title}. {step.description}</p>
        )}
      </dialog>
    </>
  );
}
