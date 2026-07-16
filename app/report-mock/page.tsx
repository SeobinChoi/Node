import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "군-학 AI 실무지원 목업 | Node",
  description: "중간보고서 증빙 캡처를 위한 군-학 AI 실무지원 목업 서비스",
};

const graphNodes = [
  {
    title: "훈련 계획 초안",
    owner: "작전계획반",
    status: "진행",
    tone: "border-blue-300 bg-blue-50",
    position: "left-[6%] top-[18%]",
  },
  {
    title: "장비 점검표 취합",
    owner: "군수반",
    status: "대기",
    tone: "border-amber-300 bg-amber-50",
    position: "left-[38%] top-[10%]",
  },
  {
    title: "지휘관 승인",
    owner: "참모부",
    status: "차단",
    tone: "border-red-300 bg-red-50",
    position: "left-[68%] top-[28%]",
  },
  {
    title: "주간 보고 반영",
    owner: "행정반",
    status: "준비",
    tone: "border-emerald-300 bg-emerald-50",
    position: "left-[30%] top-[58%]",
  },
];

const nowQueue = [
  ["우선", "장비 점검표 미제출 2건 재요청"],
  ["오늘", "훈련 계획 초안 문구 검토"],
  ["승인", "지휘관 확인 전 위험요인 요약"],
];

const documentFields = [
  ["문서 유형", "훈련 계획 보고"],
  ["목적", "7월 합동 점검 일정 공유"],
  ["문체", "공식 보고서형"],
  ["보안", "비식별 더미 자료만 사용"],
];

const actionItems = [
  ["결정사항", "야간 장비 점검은 7월 12일로 조정"],
  ["조치사항", "군수반은 예비 배터리 현황을 7월 5일까지 입력"],
  ["위험요인", "우천 시 실외 통신 점검 일정 지연 가능"],
];

const navigationItems: Array<{
  icon: LucideIcon;
  label: string;
  active?: boolean;
}> = [
  { icon: LayoutDashboard, label: "병목 관리 대시보드", active: true },
  { icon: FileText, label: "행정문서 초안 작성" },
  { icon: MessageSquareText, label: "회의록/AAR 요약" },
  { icon: ListChecks, label: "주간상황보고 취합" },
  { icon: ShieldCheck, label: "보안 검토 체크리스트" },
];

const weeklyStats: Array<{
  icon: LucideIcon;
  value: string;
  label: string;
}> = [
  { icon: UsersRound, value: "6개", label: "부서 입력" },
  { icon: CalendarDays, value: "82%", label: "조치 완료" },
  { icon: AlertTriangle, value: "2건", label: "위험 항목" },
];

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default function ReportMockPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <GitBranch className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Node</p>
              <p className="text-xs text-slate-500">군-학 AI 실무지원 목업</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1 text-sm">
            {navigationItems.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-600"
                }`}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              캡처용 시나리오
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              7월 합동훈련 준비 과업
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              실제 작전 정보 없이 더미 업무, 더미 인원, 비식별 문서만 사용한 보고서 증빙 화면입니다.
            </p>
          </div>
        </aside>

        <section className="p-4 sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="bg-emerald-100 text-emerald-700">Mock MVP</Pill>
                <Pill tone="bg-blue-100 text-blue-700">보고서 캡처 가능</Pill>
                <Pill tone="bg-slate-200 text-slate-700">비식별 데이터</Pill>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">
                군 실무 AI 지원 서비스 통합 목업
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Node의 업무 그래프를 중심으로 행정문서 초안 작성, 회의록/AAR 요약, 주간상황보고 취합을 하나의 시연 흐름으로 구성했습니다.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-2 text-center">
              {[
                ["7", "캡처 화면"],
                ["3", "AI 모듈"],
                ["0", "민감자료"],
              ].map(([value, label]) => (
                <div key={label} className="min-w-20 px-2 py-2">
                  <p className="text-xl font-semibold">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </header>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="자동 산출 상태" value="86%" sub="진행 가능 업무 식별률" />
            <Metric label="문서 초안 시간" value="12분" sub="기존 대비 약 60% 절감" />
            <Metric label="후속조치 추출" value="9건" sub="회의록/AAR 더미 입력 기준" />
            <Metric label="보안 체크" value="통과" sub="개인정보/작전정보 미포함" />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project 1
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">업무 그래프 병목 관리</h2>
                </div>
                <Pill tone="bg-red-100 text-red-700">1개 차단</Pill>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_240px]">
                <div className="relative h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <div className="absolute inset-x-6 top-6 flex items-center justify-between text-xs text-slate-500">
                    <span>7월 합동훈련 준비 프로젝트</span>
                    <span>Saved</span>
                  </div>
                  <div className="absolute left-[22%] top-[34%] h-[2px] w-[23%] rotate-[-12deg] bg-slate-300" />
                  <div className="absolute left-[52%] top-[31%] h-[2px] w-[22%] rotate-[20deg] bg-slate-300" />
                  <div className="absolute left-[41%] top-[52%] h-[2px] w-[28%] rotate-[-28deg] bg-slate-300" />
                  <div className="absolute left-[23%] top-[54%] h-[2px] w-[20%] rotate-[26deg] bg-slate-300" />

                  {graphNodes.map((node) => (
                    <div
                      key={node.title}
                      className={`absolute w-44 rounded-lg border p-3 shadow-sm ${node.position} ${node.tone}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold leading-5">{node.title}</p>
                        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-600">
                          {node.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">{node.owner}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-blue-600" />
                      <p className="text-sm font-semibold">지금 처리할 일</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {nowQueue.map(([tag, text]) => (
                        <div key={text} className="flex gap-2 text-sm">
                          <span className="h-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {tag}
                          </span>
                          <span className="leading-5 text-slate-700">{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <Bot className="size-4 text-emerald-600" />
                      <p className="text-sm font-semibold">AI 요청 초안</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      군수반 확인이 필요한 점검표 2건이 지연되어 승인 노드가 차단되었습니다. 오늘 17시 전 제출 가능 여부를 회신해 주십시오.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                구현 계획
              </p>
              <h2 className="mt-1 text-lg font-semibold">목업에서 MVP까지</h2>
              <div className="mt-4 space-y-4">
                {[
                  ["1", "더미 데이터 기반 시연 화면 고정", "보고서 캡처와 사용자 설명에 필요한 주요 화면을 먼저 확보합니다."],
                  ["2", "Node 그래프 API와 연결", "프로젝트, 노드, 요청, 담당자 상태를 실제 DB 모델과 연결합니다."],
                  ["3", "AI 생성 기능 분리", "문서 초안, 요청 초안, 요약 생성 API를 승인된 더미 입력부터 붙입니다."],
                  ["4", "보안 검토 게이트", "민감정보 입력 금지, 비식별 확인, 최종 검토 체크리스트를 저장합니다."],
                ].map(([step, title, body]) => (
                  <div key={step} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-semibold text-white">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project 2
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">행정문서 작성 지원</h2>
                </div>
                <FileText className="size-5 text-slate-500" />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[210px_1fr]">
                <div className="space-y-2">
                  {documentFields.map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-blue-600" />
                    <p className="text-sm font-semibold">생성된 초안 미리보기</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    7월 합동 점검 계획을 아래와 같이 보고드립니다. 본 일정은 더미 훈련 시나리오를 기준으로 작성되었으며, 실제 부대명, 장소, 장비명은 최종 검토 단계에서 비식별 값으로 유지합니다.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {["형식 점검", "민감정보 제거", "담당자 검토"].map((label) => (
                      <div key={label} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project 3
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">회의록/AAR/주간보고 요약</h2>
                </div>
                <ClipboardCheck className="size-5 text-slate-500" />
              </div>

              <div className="mt-4 space-y-3">
                {actionItems.map(([label, text]) => (
                  <div key={label} className="grid gap-2 rounded-lg border border-slate-200 px-3 py-3 sm:grid-cols-[86px_1fr]">
                    <span className="text-xs font-semibold text-slate-500">{label}</span>
                    <span className="text-sm leading-5 text-slate-700">{text}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {weeklyStats.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="rounded-lg border border-slate-200 p-3">
                    <Icon className="size-4 text-slate-500" />
                    <p className="mt-2 text-lg font-semibold">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  보고서 첨부 화면 목록
                </p>
                <h2 className="mt-1 text-lg font-semibold">중간보고서 별첨에 붙일 캡처 순서</h2>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span>목업 화면</span>
                <ArrowRight className="size-4" />
                <span>문서/PDF 증빙</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                "통합 대시보드",
                "업무 그래프 병목 화면",
                "AI 요청 초안",
                "행정문서 생성 결과",
                "보안 검토 체크리스트",
                "회의록 요약 결과",
                "주간상황보고 지표",
                "구현 계획 로드맵",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
