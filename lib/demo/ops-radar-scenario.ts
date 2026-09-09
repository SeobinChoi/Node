import type { DemoTask } from "@/lib/demo/ops-radar-types";

export const OPS_RADAR_TODAY = "2026-09-06";

export interface OpsRadarScenario {
  id: string;
  title: string;
  summary: string;
  tasks: DemoTask[];
}

export const OPS_RADAR_SCENARIOS: OpsRadarScenario[] = [
  {
    id: "night-comms",
    title: "야간 통신 점검",
    summary: "야간 통신 점검 전 점검표 회수와 안전 통제 승인이 선행되는 상황입니다.",
    tasks: [
      { id: "checklist", title: "점검표 제출", owner: "운영반", dueDate: "2026-09-05", risk: "high", state: "open", dependencies: [] },
      { id: "approval", title: "안전 통제 승인", owner: "안전반", dueDate: "2026-09-08", risk: "high", state: "approval_pending", dependencies: ["checklist"] },
      { id: "night", title: "야간 통신 점검", owner: "통신반", dueDate: "2026-09-09", risk: "high", state: "open", dependencies: ["approval"] },
      { id: "report", title: "주간 상황보고", owner: "상황반", dueDate: "2026-09-10", risk: "medium", state: "open", dependencies: ["night"] },
      { id: "vehicle", title: "장비 점검 결과 확인", owner: "군수반", dueDate: "2026-09-09", risk: "medium", state: "open", dependencies: [] },
      { id: "briefing", title: "지휘관 브리핑 자료", owner: "기획반", dueDate: "2026-09-11", risk: "medium", state: "open", dependencies: ["report", "vehicle"] },
      { id: "archive", title: "전일 조치기록 정리", owner: "상황반", dueDate: "2026-09-05", risk: "low", state: "completed", dependencies: [] },
    ],
  },
  {
    id: "equipment-return",
    title: "장비 반납 정비",
    summary: "반납 대상 장비 조사가 지연되어 정비와 인계 일정이 함께 밀린 상황입니다.",
    tasks: [
      { id: "inventory", title: "반납 대상 장비 조사", owner: "군수반", dueDate: "2026-09-04", risk: "high", state: "open", dependencies: [] },
      { id: "inspection", title: "장비 상태 점검", owner: "정비반", dueDate: "2026-09-08", risk: "medium", state: "open", dependencies: ["inventory"] },
      { id: "return-approval", title: "반납 승인 요청", owner: "행정반", dueDate: "2026-09-09", risk: "high", state: "approval_pending", dependencies: ["inspection"] },
      { id: "handover", title: "반납 인계 실시", owner: "군수반", dueDate: "2026-09-11", risk: "medium", state: "open", dependencies: ["return-approval"] },
      { id: "ledger", title: "재물조사 대장 정리", owner: "행정반", dueDate: "2026-09-05", risk: "low", state: "completed", dependencies: [] },
    ],
  },
  {
    id: "joint-exercise",
    title: "합동 훈련 준비",
    summary: "훈련장 협조가 지연되고 안전통제 승인이 남아 준비 과업이 넓게 묶인 상황입니다.",
    tasks: [
      { id: "plan", title: "훈련계획 수립", owner: "작전계획반", dueDate: "2026-09-03", risk: "high", state: "completed", dependencies: [] },
      { id: "terrain", title: "훈련장 사용 협조", owner: "작전계획반", dueDate: "2026-09-05", risk: "high", state: "open", dependencies: ["plan"] },
      { id: "safety", title: "안전통제 계획 승인", owner: "안전반", dueDate: "2026-09-08", risk: "high", state: "approval_pending", dependencies: ["plan"] },
      { id: "supply", title: "보급 물자 청구", owner: "군수반", dueDate: "2026-09-07", risk: "medium", state: "open", dependencies: ["plan"] },
      { id: "transport", title: "차량 배차 계획", owner: "수송반", dueDate: "2026-09-09", risk: "medium", state: "open", dependencies: ["supply", "terrain"] },
      { id: "comms", title: "통신망 구성", owner: "통신반", dueDate: "2026-09-09", risk: "medium", state: "open", dependencies: ["terrain"] },
      { id: "medical", title: "의무 지원 편성", owner: "의무대", dueDate: "2026-09-10", risk: "low", state: "open", dependencies: ["safety"] },
      { id: "rehearsal", title: "예행연습 실시", owner: "작전계획반", dueDate: "2026-09-11", risk: "high", state: "open", dependencies: ["transport", "comms", "safety"] },
      { id: "exercise-brief", title: "훈련 개시 브리핑", owner: "상황반", dueDate: "2026-09-12", risk: "medium", state: "open", dependencies: ["rehearsal", "medical"] },
    ],
  },
  {
    id: "weather-response",
    title: "호우 대비 태세",
    summary: "배수로 점검이 지연되어 대피계획 승인과 야간 순찰 편성이 대기 중인 상황입니다.",
    tasks: [
      { id: "forecast", title: "기상 예보 확인", owner: "상황반", dueDate: "2026-09-04", risk: "medium", state: "completed", dependencies: [] },
      { id: "drainage", title: "배수로 점검", owner: "시설반", dueDate: "2026-09-05", risk: "high", state: "open", dependencies: ["forecast"] },
      { id: "sandbag", title: "수방 자재 확보", owner: "군수반", dueDate: "2026-09-07", risk: "high", state: "open", dependencies: ["forecast"] },
      { id: "evacuation", title: "취약지역 대피계획 승인", owner: "안전반", dueDate: "2026-09-08", risk: "high", state: "approval_pending", dependencies: ["drainage", "sandbag"] },
      { id: "patrol", title: "야간 순찰조 편성", owner: "당직사령", dueDate: "2026-09-09", risk: "medium", state: "open", dependencies: ["evacuation"] },
      { id: "damage-report", title: "피해현황 보고", owner: "상황반", dueDate: "2026-09-10", risk: "low", state: "open", dependencies: ["patrol"] },
    ],
  },
];

export const DEFAULT_OPS_RADAR_SCENARIO_ID = OPS_RADAR_SCENARIOS[0].id;

export function opsRadarScenarioById(scenarioId: string = DEFAULT_OPS_RADAR_SCENARIO_ID): OpsRadarScenario {
  return OPS_RADAR_SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? OPS_RADAR_SCENARIOS[0];
}

export function freshOpsRadarScenario(scenarioId: string = DEFAULT_OPS_RADAR_SCENARIO_ID): DemoTask[] {
  return opsRadarScenarioById(scenarioId).tasks.map((task) => ({ ...task, dependencies: [...task.dependencies] }));
}
