"use client";

import { useEffect, useRef, useState } from "react";

export const PUBLIC_DEMO_TOUR_STORAGE_KEY = "node-public-demo-tour-v1";

export type PublicDemoTourPageId = "militaryAi" | "opsRadar" | "adminDoc" | "afterAction";
export type PublicDemoTourDirection = "forward" | "backward";
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
  | "after-action-source"
  | "after-action-generate"
  | "after-action-result";

export type PublicDemoTourStep = {
  targetId: PublicDemoTourTargetId;
  title: string;
  description: string;
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
};

export const PUBLIC_DEMO_TOUR_PAGES: readonly PublicDemoTourPage[] = [
  {
    id: "militaryAi",
    label: "문서지원",
    href: "/military-ai-demo",
    steps: [
      { targetId: "military-ai-tools", title: "문서 작업 선택", description: "문서, 회의, AAR, 주간보고, 보안검토 중 필요한 작업을 선택합니다." },
      { targetId: "military-ai-input", title: "작성 조건 입력", description: "문서 작성에 필요한 조건과 예시를 확인합니다." },
      { targetId: "military-ai-generate", title: "문서 생성", description: "시연용 문서를 만드는 동작입니다. 튜토리얼이 대신 실행하지 않습니다." },
    ],
  },
  {
    id: "opsRadar",
    label: "과업상황",
    href: "/ops-radar-demo",
    steps: [
      { targetId: "ops-radar-tasks", title: "과업 현황", description: "과업과 선후행 관계를 한곳에서 확인합니다." },
      { targetId: "ops-radar-evaluate", title: "병목 평가", description: "시연 평가를 시작하는 위치입니다. 튜토리얼은 평가를 실행하지 않습니다." },

    ],
  },
  {
    id: "adminDoc",
    label: "행정문서",
    href: "/admin-doc-demo",
    steps: [
      { targetId: "admin-doc-type", title: "문서 유형 선택", description: "작성할 행정문서의 유형을 선택합니다." },
      { targetId: "admin-doc-generate", title: "초안 작성", description: "선택한 유형의 초안을 만드는 위치입니다. 튜토리얼은 실행하지 않습니다." },

    ],
  },
  {
    id: "afterAction",
    label: "사후조치",
    href: "/after-action-demo",
    steps: [
      { targetId: "after-action-source", title: "회의·훈련 자료", description: "요약에 사용할 시연 자료를 확인합니다." },
      { targetId: "after-action-generate", title: "사후조치 정리", description: "요약을 만드는 위치입니다. 튜토리얼은 실행하지 않습니다." },

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
  const [view, setView] = useState<"loading" | "welcome" | "tour" | "closed">("loading");
  const [tourState, setTourState] = useState<PublicDemoTourState | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  function close(status: "dismissed" | "completed") {
    const state: PublicDemoTourState = {
      status,
      pageIndex: tourState?.pageIndex ?? 0,
      stepIndex: tourState?.stepIndex ?? 0,
      direction: "forward",
    };
    writeState(state);
    setView("closed");
    setTourState(state);
    setTargetRect(null);
  }

  function activate(candidate: PublicDemoTourState) {
    let pageIndex = candidate.pageIndex;
    let stepIndex = candidate.stepIndex;
    const direction = candidate.direction;

    while (pageIndex >= 0 && pageIndex < PUBLIC_DEMO_TOUR_PAGES.length) {
      const page = PUBLIC_DEMO_TOUR_PAGES[pageIndex];
      if (page.id !== currentPage) {
        const nextState = { status: "active", pageIndex, stepIndex, direction } as const;
        writeState(nextState);
        window.location.assign(page.href);
        return;
      }

      const end = direction === "forward" ? page.steps.length : -1;
      for (let index = stepIndex; index !== end; index += direction === "forward" ? 1 : -1) {
        const target = document.querySelector<HTMLElement>(`[data-tour-id="${page.steps[index].targetId}"]`);
        if (!target) continue;
        const nextState = { status: "active", pageIndex, stepIndex: index, direction } as const;
        writeState(nextState);
        setTourState(nextState);
        setTargetRect(target.getBoundingClientRect());
        target.scrollIntoView({ block: "center", behavior: "smooth" });
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
    activate({ status: "active", pageIndex: 0, stepIndex: 0, direction: "forward" });
  }

  function move(direction: PublicDemoTourDirection) {
    if (!tourState) return;
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

    activate({ status: "active", pageIndex, stepIndex, direction });
  }

  useEffect(() => {
    const stored = readState();
    const task = window.requestAnimationFrame(() => {
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
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }
  }, [view]);

  useEffect(() => {
    if (view !== "tour" || !tourState) return;
    const targetId = PUBLIC_DEMO_TOUR_PAGES[tourState.pageIndex].steps[tourState.stepIndex].targetId;
    const update = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
      if (target) setTargetRect(target.getBoundingClientRect());
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tourState, view]);

  const page = tourState ? PUBLIC_DEMO_TOUR_PAGES[tourState.pageIndex] : null;
  const step = page && tourState ? page.steps[tourState.stepIndex] : null;
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const cardLeft = targetRect ? Math.min(Math.max(targetRect.left, 16), viewportWidth - 400) : 16;
  const cardTop = targetRect ? Math.min(targetRect.bottom + 16, viewportHeight - 300) : 96;
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
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-visible bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/45"
      >
        {view === "tour" && targetRect && (
          <span
            aria-hidden="true"
            className="pointer-events-none fixed border-4 border-amber-400 bg-amber-200/10 shadow-[0_0_0_4px_rgba(15,23,42,0.35)]"
            style={{ left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12, height: targetRect.height + 12 }}
          />
        )}

        {view === "welcome" && (
          <section className="fixed left-1/2 top-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 border border-slate-300 bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold text-blue-700">4개 공개 시연 둘러보기</p>
            <h2 id="public-demo-tour-title" className="mt-2 text-2xl font-bold">Node 공개 시연에 오신 것을 환영합니다</h2>
            <p id="public-demo-tour-description" className="mt-3 text-sm leading-6 text-slate-600">
              문서지원, 과업상황, 행정문서, 사후조치 화면을 차례로 안내합니다. 실제 기능을 자동으로 실행하거나 API를 호출하지 않습니다.
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
            className="fixed bottom-0 left-0 w-full border border-slate-300 bg-white p-5 shadow-2xl [top:auto] sm:bottom-auto sm:w-96 sm:[left:var(--tour-left)] sm:[top:var(--tour-top)]"
          >
            <p className="text-xs font-semibold text-blue-700">화면 {tourState.pageIndex + 1}/4 · 단계 {tourState.stepIndex + 1}/{page.steps.length}</p>
            <h2 id="public-demo-tour-title" className="mt-2 text-lg font-bold">{step.title}</h2>
            <p id="public-demo-tour-description" className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button type="button" onClick={() => close("dismissed")} className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">종료</button>
              <div className="flex gap-2">
                <button type="button" disabled={tourState.pageIndex === 0 && tourState.stepIndex === 0} onClick={() => move("backward")} className="border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">이전</button>
                <button type="button" autoFocus onClick={() => move("forward")} className="bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                  {tourState.pageIndex === PUBLIC_DEMO_TOUR_PAGES.length - 1 && tourState.stepIndex === page.steps.length - 1 ? "완료" : "다음"}
                </button>
              </div>
            </div>
          </section>
        )}
      </dialog>
    </>
  );
}
