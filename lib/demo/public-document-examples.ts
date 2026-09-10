export type PublicDocumentTool =
  | "adminDocument"
  | "approvalDocument"
  | "meetingSummary"
  | "aarSummary"
  | "weeklyReport"
  | "securityScan";

export interface PublicDocumentSection {
  label: string;
  body: string;
}

export interface PublicDocumentAction {
  title: string;
  owner: string;
  dueDate: string;
  risk: "low" | "medium" | "high";
}

export interface PublicDocumentBaselineResult {
  title: string;
  summary: string;
  sections: PublicDocumentSection[];
  actions: PublicDocumentAction[];
}

export interface PublicDocumentExample {
  id: string;
  tool: PublicDocumentTool;
  label: string;
  sourceText: string;
  baselineResult: PublicDocumentBaselineResult;
}

export const PUBLIC_DOCUMENT_EXAMPLES: PublicDocumentExample[] = [
  // adminDocument — 보고서
  {
    id: "admin-joint-inspection",
    tool: "adminDocument",
    label: "합동점검 결과보고",
    sourceText:
      "[합동점검 결과 메모]\n" +
      "- 일시: 2026-09-01(화), 주관 시설관리담당관\n" +
      "- 점검 대상 12개소 중 9개소 점검 완료, 잔여 3개소는 2026-09-08까지 재점검 예정\n" +
      "- 노후 배관 결함 2건 확인 — 예산 확보가 지연되면 하자 확대 위험\n" +
      "- 안전관리계장 보고: 소화설비 점검표 5부 중 3부만 회수, 나머지는 미결\n" +
      "- 비고: 재점검 완료 후 배관 교체 여부 재검토 필요",
    baselineResult: {
      title: "합동점검 결과보고",
      summary: "시설 12개소 중 9개소 점검을 완료했고 나머지 3개소는 재점검 예정이며, 노후 배관 결함과 소화설비 점검표 회수 지연이 확인되었다.",
      sections: [
        { label: "보고 목적", body: "정기 합동점검 결과를 공유하고 후속 조치가 필요한 결함 사항을 보고하기 위함." },
        { label: "현황", body: "시설 12개소 중 9개소 점검 완료, 3개소는 2026-09-08까지 재점검 예정." },
        { label: "문제점", body: "노후 배관 결함 2건 확인, 소화설비 점검표 5부 중 3부만 회수." },
        { label: "조치계획", body: "재점검 완료 후 배관 교체 예산을 확보하고 미회수 점검표 2부를 독려한다." },
        { label: "미확정값", body: "배관 교체 예산 확보 시점은 [미정]." },
        { label: "검토항목", body: "예산 지연 위험에 대한 대체 재원 검토가 필요하다." },
      ],
      actions: [
        { title: "미점검 3개소 재점검", owner: "시설관리담당관", dueDate: "2026-09-08", risk: "medium" },
        { title: "미회수 점검표 2부 회수", owner: "안전관리계장", dueDate: "2026-09-10", risk: "low" },
      ],
    },
  },
  {
    id: "admin-heavy-rain-readiness",
    tool: "adminDocument",
    label: "호우 대비 현황",
    sourceText:
      "상황관리반장은 2026-06-20 호우 대비 태세 점검 결과를 다음과 같이 전달했다. 배수로 정비는 총 8개 구간 중 6개 구간을 완료했으며, 남은 2개 구간은 2026-06-27까지 정비를 마칠 계획이다. " +
      "시설관리담당관에 따르면 침수 취약 지하시설이 3곳 확인되어 장마철 침수 위험이 높다고 한다. 모래주머니는 현재 400개가 비축되어 있으나 추가 확보 물량은 아직 미정이다.",
    baselineResult: {
      title: "호우 대비 현황 보고",
      summary: "배수로 정비는 8개 구간 중 6개 구간을 완료했으며, 지하시설 침수 위험과 자재 추가 확보 여부가 남은 과제다.",
      sections: [
        { label: "보고 목적", body: "장마철 대비 배수로 정비 및 자재 비축 현황을 공유하기 위함." },
        { label: "현황", body: "배수로 8개 구간 중 6개 구간 정비 완료, 2개 구간은 2026-06-27까지 정비 예정." },
        { label: "문제점", body: "침수 취약 지하시설 3곳 확인, 장마철 침수 위험이 크다." },
        { label: "조치계획", body: "잔여 구간 정비를 완료하고 침수 취약 지하시설에 임시 차수판을 설치한다." },
        { label: "미확정값", body: "모래주머니 추가 확보 수량은 [미정]." },
        { label: "검토항목", body: "침수 위험 지하시설에 대한 우선순위 재배정 검토가 필요하다." },
      ],
      actions: [
        { title: "잔여 배수로 2개 구간 정비", owner: "시설관리담당관", dueDate: "2026-06-27", risk: "high" },
        { title: "차수판 설치", owner: "상황관리반장", dueDate: "2026-06-25", risk: "medium" },
      ],
    },
  },
  {
    id: "admin-equipment-return-progress",
    tool: "adminDocument",
    label: "장비 반납 진행",
    sourceText:
      "[장비 반납 진행 메모 — 2026-04-10]\n" +
      "- 군수담당관 정리: 반납 대상 장비 30점 중 22점 반납 완료, 잔여 8점은 2026-04-18까지 반납 예정\n" +
      "- 정비관리계장 확인: 반납 장비 중 5점 외관 손상 발견, 정비비 정산 지연 위험 있음\n" +
      "- 수령 확인서 회수 현황: 미결",
    baselineResult: {
      title: "장비 반납 진행 보고",
      summary: "장비 30점 중 22점 반납을 완료했으며, 손상 장비 정산 지연 위험과 수령 확인서 미결 사항이 남아 있다.",
      sections: [
        { label: "보고 목적", body: "장비 반납 진행 현황과 손상 확인 결과를 보고하기 위함." },
        { label: "현황", body: "반납 대상 30점 중 22점 반납 완료, 8점은 2026-04-18까지 반납 예정." },
        { label: "문제점", body: "반납 장비 5점에서 외관 손상 확인, 정비비 정산 지연 위험." },
        { label: "조치계획", body: "손상 장비 정비비를 산정하고 수령 확인서를 회수한다." },
        { label: "미확정값", body: "손상 장비 정비비 최종 금액은 [미정]." },
        { label: "검토항목", body: "정산 지연이 예산 집행률에 미치는 영향 검토가 필요하다." },
      ],
      actions: [
        { title: "잔여 8점 반납 완료", owner: "군수담당관", dueDate: "2026-04-18", risk: "medium" },
        { title: "손상 장비 정비비 산정", owner: "정비관리계장", dueDate: "2026-04-20", risk: "medium" },
      ],
    },
  },

  // approvalDocument — 결재
  {
    id: "approval-spare-battery-purchase",
    tool: "approvalDocument",
    label: "예비 배터리 구매",
    sourceText:
      "[결재 상신] 예비 배터리 추가 구매\n" +
      "기안자: 군수담당관 / 기안일: 2026-05-04\n" +
      "- 현재 재고 15개, 수요 조사(완료) 결과 필요량은 40개로 확인됨\n" +
      "- 부족분 25개를 구매관리계장 산정 기준 350만원에 구매 요청\n" +
      "- 단가 협상 미결 상태로, 2026-05-11까지 협상 완료 예정이며 지연 시 승인 지연 위험이 있음",
    baselineResult: {
      title: "예비 배터리 구매 결재 요청",
      summary: "예비 배터리 재고 15개로는 수요를 충족하지 못해 25개를 350만원에 추가 구매하는 결재를 요청한다.",
      sections: [
        { label: "결재 요지", body: "예비 배터리 25개를 350만원에 구매하는 안건을 결재 요청함." },
        { label: "추진 근거", body: "수요 조사 결과 필요량 40개 대비 현재 재고 15개로 부족." },
        { label: "요청사항", body: "구매 예산 350만원 배정과 구매 절차 진행 승인을 요청." },
        { label: "일정·비용", body: "구매 비용 350만원, 단가 협상 완료 후 2주 내 납품 목표." },
        { label: "검토·승인 조건", body: "단가 협상이 완료된 이후에만 최종 구매를 진행한다." },
      ],
      actions: [
        { title: "단가 협상 완료", owner: "구매관리계장", dueDate: "2026-05-11", risk: "medium" },
        { title: "구매 승인 상신", owner: "군수담당관", dueDate: "2026-05-06", risk: "low" },
      ],
    },
  },
  {
    id: "approval-training-vehicle-support",
    tool: "approvalDocument",
    label: "훈련 차량 지원",
    sourceText:
      "교육훈련담당관은 2026-08-12 훈련 차량 지원 건을 결재 요청하며 \"예정된 훈련 인원 120명을 이동시키려면 차량 6대가 필요합니다\"라고 밝혔다. " +
      "수송관리반장 확인 결과 가용 차량 4대는 확보를 완료했고, 나머지 2대는 2026-08-19까지 외부 임차가 필요하다. 임차가 지연되면 훈련 일정 자체가 밀릴 위험이 있다.",
    baselineResult: {
      title: "훈련 차량 지원 결재 요청",
      summary: "훈련 인원 120명 수송에 필요한 차량 6대 중 4대를 확보했으며, 나머지 2대 임차 승인을 요청한다.",
      sections: [
        { label: "결재 요지", body: "훈련 차량 2대 외부 임차 예산 승인을 요청함." },
        { label: "추진 근거", body: "훈련 인원 120명 수송에 필요한 차량 6대 중 4대만 자체 확보 가능." },
        { label: "요청사항", body: "임차 차량 2대에 대한 예산 배정과 계약 진행 승인을 요청." },
        { label: "일정·비용", body: "임차 완료 목표일 2026-08-19." },
        { label: "검토·승인 조건", body: "임차 지연 시 훈련 일정 조정 여부를 사전 검토한다." },
      ],
      actions: [
        { title: "외부 차량 2대 임차 계약", owner: "수송관리반장", dueDate: "2026-08-19", risk: "high" },
        { title: "임차 예산 승인 상신", owner: "교육훈련담당관", dueDate: "2026-08-13", risk: "medium" },
      ],
    },
  },
  {
    id: "approval-facility-repair",
    tool: "approvalDocument",
    label: "시설 보수 시행",
    sourceText:
      "[결재 요청] 청사 옥상 방수 보수 시행\n" +
      "작성: 시설관리담당관, 2026-03-02\n" +
      "사전 진단 완료 — 누수 구간 3곳 확인\n" +
      "예산관리계장 산정 비용: 480만원\n" +
      "시공업체 선정: 미결 (2026-05-31까지 완료하지 못하면 누수 피해 확대 위험)",
    baselineResult: {
      title: "청사 옥상 방수 보수 결재 요청",
      summary: "누수 구간 3곳에 대한 방수 보수 480만원 집행을 요청하며, 우기 전 완료가 필요하다.",
      sections: [
        { label: "결재 요지", body: "청사 옥상 방수 보수 공사 480만원 집행을 요청함." },
        { label: "추진 근거", body: "사전 진단 결과 누수 구간 3곳 확인, 우기 전 보수 필요." },
        { label: "요청사항", body: "보수 예산 480만원 배정과 시공업체 선정 절차 진행 승인을 요청." },
        { label: "일정·비용", body: "보수 비용 480만원, 우기 전인 2026-05-31까지 완료 목표." },
        { label: "검토·승인 조건", body: "시공업체 선정 완료 후 착공하며, 선정 지연 시 일정 재검토." },
      ],
      actions: [
        { title: "시공업체 선정", owner: "예산관리계장", dueDate: "2026-03-16", risk: "high" },
        { title: "보수 예산 집행 승인 상신", owner: "시설관리담당관", dueDate: "2026-03-05", risk: "medium" },
      ],
    },
  },

  // meetingSummary — 회의록/조치
  {
    id: "meeting-schedule-coordination",
    tool: "meetingSummary",
    label: "일정조정 회의",
    sourceText:
      "[회의록] 일정조정 회의\n" +
      "일시: 2026-02-10 / 주관: 기획관리계장 / 참석: 상황관리반장, 교육훈련담당관\n" +
      "안건 3건 중 2건 결정 완료, 1건 미결\n" +
      "결정: 차기 훈련 일정 2026-02-24로 확정\n" +
      "비고: 장소 예약이 지연되면 일정 변경 위험 있음",
    baselineResult: {
      title: "일정조정 회의록",
      summary: "차기 훈련 일정을 2026-02-24로 확정했으나 장소 예약 지연 시 일정 변경 위험이 있어 후속 확인이 필요하다.",
      sections: [
        { label: "회의 개요", body: "2026-02-10 기획관리계장 주관, 상황관리반장·교육훈련담당관 참석." },
        { label: "결정사항", body: "차기 훈련 일정을 2026-02-24로 확정. 안건 3건 중 2건 결정 완료." },
        { label: "미결사항", body: "훈련 장소 예약 확정 여부는 미결 상태." },
      ],
      actions: [
        { title: "훈련 장소 예약 확정", owner: "상황관리반장", dueDate: "2026-02-17", risk: "medium" },
        { title: "확정 일정 관계부서 통보", owner: "기획관리계장", dueDate: "2026-02-12", risk: "low" },
      ],
    },
  },
  {
    id: "meeting-safety-control",
    tool: "meetingSummary",
    label: "안전통제 회의",
    sourceText:
      "2026-07-03 안전관리계장 주관으로 안전통제 회의를 진행했다. 현장통제반장과 시설관리담당관이 참석했으며, 지정된 통제 구역 4곳 가운데 3곳은 표지판 설치를 마쳤다는 보고가 있었다. " +
      "나머지 1곳은 아직 미완료 상태로 남아 있어 사고 위험이 우려된다는 의견이 나왔고, 2026-07-08까지 조속히 조치하기로 결정했다.",
    baselineResult: {
      title: "안전통제 회의록",
      summary: "통제 구역 4곳 중 3곳은 표지판 설치를 완료했으며, 미설치 1곳의 사고 위험 해소가 남은 과제다.",
      sections: [
        { label: "회의 개요", body: "2026-07-03 안전관리계장 주관, 현장통제반장·시설관리담당관 참석." },
        { label: "결정사항", body: "미설치 구역 표지판을 최우선 설치하기로 결정." },
        { label: "미결사항", body: "통제 구역 1곳 표지판 설치가 미완료 상태." },
      ],
      actions: [
        { title: "미설치 구역 표지판 설치", owner: "현장통제반장", dueDate: "2026-07-08", risk: "high" },
        { title: "통제 구역 점검 결과 보고", owner: "안전관리계장", dueDate: "2026-07-10", risk: "low" },
      ],
    },
  },
  {
    id: "meeting-equipment-handover",
    tool: "meetingSummary",
    label: "장비 인수인계 회의",
    sourceText:
      "[회의록] 장비 인수인계 회의\n" +
      "일시: 2026-01-15 / 주관: 군수담당관 / 참석: 정비관리계장, 물자관리반장\n" +
      "- 인계 대상 장비 18점 중 14점 인수인계 완료\n" +
      "- 잔여 4점 상태 확인 미결 → 확인 지연 시 인계 일정 지연 위험\n" +
      "- 결정사항: 2026-01-20까지 재확인 완료",
    baselineResult: {
      title: "장비 인수인계 회의록",
      summary: "장비 18점 중 14점은 인수인계를 완료했으며, 나머지 4점 상태 확인이 지연되면 일정 위험이 있다.",
      sections: [
        { label: "회의 개요", body: "2026-01-15 군수담당관 주관, 정비관리계장·물자관리반장 참석." },
        { label: "결정사항", body: "미확인 4점에 대해 우선 상태 점검을 실시하기로 결정." },
        { label: "미결사항", body: "장비 4점의 상태 확인 결과가 미결 상태." },
      ],
      actions: [
        { title: "미확인 장비 4점 상태 점검", owner: "정비관리계장", dueDate: "2026-01-20", risk: "medium" },
        { title: "인수인계 완료 보고", owner: "물자관리반장", dueDate: "2026-01-22", risk: "low" },
      ],
    },
  },

  // aarSummary — AAR
  {
    id: "aar-night-comms-check",
    tool: "aarSummary",
    label: "야간 통신 점검 AAR",
    sourceText:
      "[AAR] 야간 통신 점검 — 2026-09-09 주관: 통신관리담당관\n" +
      "점검 항목 10개 중 8개 완료, 2개 확인 미결\n" +
      "상황관리반장 지적: 노후 장비로 인한 신호 지연 위험\n" +
      "조치: 예비 장비 확보를 2026-09-15까지 완료 예정",
    baselineResult: {
      title: "야간 통신 점검 AAR",
      summary: "점검 항목 10개 중 8개를 완료했으며, 장비 노후로 인한 신호 지연 위험과 예비 장비 확보가 후속 과제다.",
      sections: [
        { label: "상황", body: "2026-09-09 야간 통신 점검 실시, 점검 항목 10개 중 8개 완료." },
        { label: "유지할 점", body: "점검 절차를 사전 공유해 참여 인원의 이해도가 높았다." },
        { label: "개선할 점", body: "노후 장비로 인한 신호 지연 문제를 사전에 파악하지 못했다." },
        { label: "원인", body: "예비 장비 확보가 지연되어 노후 장비를 그대로 사용했다." },
      ],
      actions: [
        { title: "예비 장비 확보", owner: "통신관리담당관", dueDate: "2026-09-15", risk: "high" },
        { title: "미확인 항목 2건 재점검", owner: "상황관리반장", dueDate: "2026-09-12", risk: "medium" },
      ],
    },
  },
  {
    id: "aar-disaster-response-training",
    tool: "aarSummary",
    label: "재난대응 훈련 AAR",
    sourceText:
      "재난대응담당관은 2026-05-20 재난대응 훈련을 마친 뒤 결과를 정리했다. 참여 인원 60명 가운데 52명은 훈련 절차를 완료했지만 8명은 절차 확인이 아직 미결로 남았다. " +
      "안전관리계장은 대피 동선이 혼선을 빚어 이동이 지연됐다고 지적하며, 2026-05-27까지 동선을 재설계하지 않으면 같은 지연 위험이 반복될 것이라고 밝혔다.",
    baselineResult: {
      title: "재난대응 훈련 AAR",
      summary: "참여 인원 60명 중 52명이 절차를 완료했으나, 대피 동선 혼선으로 인한 지연 위험이 확인되었다.",
      sections: [
        { label: "상황", body: "2026-05-20 재난대응 훈련 실시, 참여 인원 60명 중 52명 절차 완료." },
        { label: "유지할 점", body: "사전 브리핑으로 대부분 인원이 절차를 신속히 숙지했다." },
        { label: "개선할 점", body: "대피 동선 혼선으로 일부 인원의 이동이 지연되었다." },
        { label: "원인", body: "동선 표지가 불명확해 8명이 절차 확인을 완료하지 못했다." },
      ],
      actions: [
        { title: "대피 동선 재설계", owner: "안전관리계장", dueDate: "2026-05-27", risk: "high" },
        { title: "미확인 인원 8명 재교육", owner: "재난대응담당관", dueDate: "2026-05-27", risk: "medium" },
      ],
    },
  },
  {
    id: "aar-supply-distribution-training",
    tool: "aarSummary",
    label: "보급품 배부 훈련 AAR",
    sourceText:
      "[AAR] 보급품 배부 훈련\n" +
      "주관: 물자관리반장 / 훈련일: 2026-10-02 / 결과 확인일: 2026-10-03\n" +
      "- 배부 대상 90세대 중 78세대 배부 완료\n" +
      "- 12세대 배부 확인 미결\n" +
      "- 군수담당관 소견: 재고 파악 오류로 지연 발생, 재발 위험 있음",
    baselineResult: {
      title: "보급품 배부 훈련 AAR",
      summary: "배부 대상 90세대 중 78세대는 배부를 완료했으며, 재고 파악 오류로 인한 지연 재발 위험이 남아 있다.",
      sections: [
        { label: "상황", body: "2026-10-02 보급품 배부 훈련 실시, 90세대 중 78세대 배부 완료." },
        { label: "유지할 점", body: "배부 순서를 사전 공지해 현장 혼선이 적었다." },
        { label: "개선할 점", body: "재고 파악 오류로 일부 세대 배부가 지연되었다." },
        { label: "원인", body: "배부 전 재고 수량 재확인 절차가 누락되었다." },
      ],
      actions: [
        { title: "재고 파악 절차 보완", owner: "군수담당관", dueDate: "2026-10-09", risk: "medium" },
        { title: "미배부 12세대 확인", owner: "물자관리반장", dueDate: "2026-10-06", risk: "high" },
      ],
    },
  },

  // weeklyReport — 주간보고
  {
    id: "weekly-logistics-status",
    tool: "weeklyReport",
    label: "군수 현황 주간보고",
    sourceText:
      "[주간보고] 군수 현황 (2026-03-09~2026-03-13)\n" +
      "작성: 군수담당관\n" +
      "- 금주 실적: 보급 요청 20건 중 17건 처리 완료, 3건 다음 주 이월 예정\n" +
      "- 정비관리계장 보고: 부품 수급 문제로 차량 정비 지연, 납기 지연 위험\n" +
      "- 차주 계획: 대체 부품처 확정",
    baselineResult: {
      title: "군수 현황 주간보고",
      summary: "보급 요청 20건 중 17건을 처리했으며, 부품 수급 문제로 인한 차량 정비 납기 지연 위험이 남아 있다.",
      sections: [
        { label: "완료", body: "보급 요청 20건 중 17건 처리 완료 (2026-03-09~03-13)." },
        { label: "진행", body: "잔여 보급 요청 3건은 다음 주로 이월." },
        { label: "위험/영향/대응", body: "부품 수급 지연으로 차량 정비 납기 지연 위험, 대체 부품처 확인으로 대응." },
        { label: "차주 계획", body: "이월 보급 요청 3건 처리 및 대체 부품처 확정." },
      ],
      actions: [
        { title: "이월 보급 요청 3건 처리", owner: "군수담당관", dueDate: "2026-03-20", risk: "medium" },
        { title: "대체 부품처 확정", owner: "정비관리계장", dueDate: "2026-03-18", risk: "high" },
      ],
    },
  },
  {
    id: "weekly-facility-maintenance",
    tool: "weeklyReport",
    label: "시설 정비 주간보고",
    sourceText:
      "시설관리담당관이 2026-11-02부터 2026-11-06까지의 시설 정비 현황을 보고했다. 정비 대상 14건 가운데 11건은 이미 완료됐고, 남은 3건은 다음 주 중 마무리할 예정이다. " +
      "예산관리계장은 최근 자재 단가가 오르면서 잔여 정비 예산이 초과될 위험이 있다고 짚었다.",
    baselineResult: {
      title: "시설 정비 주간보고",
      summary: "정비 대상 14건 중 11건을 완료했으며, 자재 단가 상승으로 인한 예산 초과 위험이 있다.",
      sections: [
        { label: "완료", body: "정비 대상 14건 중 11건 완료 (2026-11-02~11-06)." },
        { label: "진행", body: "잔여 정비 3건은 계속 진행 중." },
        { label: "위험/영향/대응", body: "자재 단가 상승으로 예산 초과 위험, 대체 자재 검토로 대응." },
        { label: "차주 계획", body: "잔여 정비 3건 완료 및 예산 재산정." },
      ],
      actions: [
        { title: "잔여 정비 3건 완료", owner: "시설관리담당관", dueDate: "2026-11-13", risk: "medium" },
        { title: "정비 예산 재산정", owner: "예산관리계장", dueDate: "2026-11-11", risk: "high" },
      ],
    },
  },
  {
    id: "weekly-training-progress",
    tool: "weeklyReport",
    label: "교육훈련 진행 주간보고",
    sourceText:
      "[주간보고] 교육훈련 진행 (2026-04-06~2026-04-10)\n" +
      "작성: 교육훈련담당관\n" +
      "- 교육 과정 6개 중 4개 이수 완료, 2개는 진행 중(미완료)\n" +
      "- 인사관리계장 의견: 강사 일정 조정 지연 시 다음 과정 개설이 늦어질 위험\n" +
      "- 차주 계획: 예비 강사 섭외 및 개강일 확정",
    baselineResult: {
      title: "교육훈련 진행 주간보고",
      summary: "교육 과정 6개 중 4개는 이수를 완료했으며, 강사 일정 조정 지연으로 다음 과정 개설이 늦어질 위험이 있다.",
      sections: [
        { label: "완료", body: "교육 과정 6개 중 4개 이수 완료 (2026-04-06~04-10)." },
        { label: "진행", body: "잔여 2개 과정은 계속 진행 중." },
        { label: "위험/영향/대응", body: "강사 일정 조정 지연으로 다음 과정 개설 지연 위험, 예비 강사 섭외로 대응." },
        { label: "차주 계획", body: "잔여 2개 과정 완료 및 다음 과정 개강 일정 확정." },
      ],
      actions: [
        { title: "예비 강사 섭외", owner: "인사관리계장", dueDate: "2026-04-17", risk: "medium" },
        { title: "다음 과정 개강 일정 확정", owner: "교육훈련담당관", dueDate: "2026-04-15", risk: "low" },
      ],
    },
  },

  // securityScan — 보안검토
  {
    id: "security-contact-info-included",
    tool: "securityScan",
    label: "담당자 연락처 포함 문안",
    sourceText:
      "민원처리담당관은 2026-02-05 민원 안내문 초안을 작성했고, 홍보계장은 2026-02-06 이를 검토했다. 접수 민원 30건 중 25건은 회신을 완료했고 5건은 아직 회신이 미결이다. " +
      "초안 하단에는 \"문의는 담당자 개인 휴대전화 010-0000-0000 또는 010-1111-1111로 연락 바랍니다\"라는 문구가 그대로 포함돼 있어, 개인 연락처 노출로 인한 사생활·업무 부담 위험이 지적됐다.",
    baselineResult: {
      title: "담당자 연락처 포함 문안 보안검토",
      summary: "초안에 담당자 개인 휴대전화 번호 2건이 그대로 노출되어 있어 대표 연락처로 교체가 필요하다.",
      sections: [
        { label: "위험수준", body: "중간 — 개인 연락처 노출로 인한 사생활·업무 부담 위험." },
        { label: "탐지항목", body: "휴대전화 번호 2건(010-0000-0000, 010-1111-1111) 노출." },
        { label: "사유", body: "개인 휴대전화 번호는 담당자 변경·휴가 시 응대 공백을 유발하고 사생활 노출 위험이 있다." },
        { label: "권장 대체표현", body: "부서 대표전화 또는 민원 접수 창구 안내로 대체." },
        { label: "안전한 재작성", body: "\"문의는 민원처리과 대표전화로 연락 바랍니다.\"로 수정 제안." },
        { label: "최종 점검", body: "개인 연락처 삭제 여부와 대표전화 안내 반영 여부를 재확인한다." },
      ],
      actions: [
        { title: "개인 연락처를 대표전화로 교체", owner: "민원처리담당관", dueDate: "2026-02-07", risk: "medium" },
        { title: "수정 문안 재검토", owner: "홍보계장", dueDate: "2026-02-08", risk: "low" },
      ],
    },
  },
  {
    id: "security-detailed-location-included",
    tool: "securityScan",
    label: "세부 위치 포함 문안",
    sourceText:
      "시설관리담당관은 2026-06-11 시설 안내문 초안을 작성했고 안전관리계장은 2026-06-12 이를 검토했다. 안내 대상 시설 5곳 중 4곳은 정보 정리를 완료했고 1곳은 확인이 미결이다. " +
      "초안에는 [보관구역] 출입 절차와 함께 [접근정보]가 구체적으로 그대로 기재되어 있어, 시설 보안 정보 노출 위험이 있다는 지적이 나왔다.",
    baselineResult: {
      title: "세부 위치 포함 문안 보안검토",
      summary: "초안에 [보관구역] 출입 절차와 [접근정보]가 구체적으로 포함되어 있어 시설 보안 노출 위험이 크다.",
      sections: [
        { label: "위험수준", body: "높음 — [보관구역] 출입·접근 정보 노출로 보안 위험이 크다." },
        { label: "탐지항목", body: "[보관구역] 출입 절차 1건, [접근정보] 기재 1건." },
        { label: "사유", body: "구체적인 출입·접근 정보가 공개되면 시설 보안 취약점으로 악용될 수 있다." },
        { label: "권장 대체표현", body: "구체적 접근 정보 대신 문의 절차 안내로 대체." },
        { label: "안전한 재작성", body: "\"[보관구역] 출입은 담당 부서에 사전 문의 바랍니다.\"로 수정 제안." },
        { label: "최종 점검", body: "[접근정보] 삭제 여부와 대체 문구 반영 여부를 재확인한다." },
      ],
      actions: [
        { title: "[접근정보] 삭제", owner: "시설관리담당관", dueDate: "2026-06-13", risk: "high" },
        { title: "수정 문안 재검토", owner: "안전관리계장", dueDate: "2026-06-14", risk: "medium" },
      ],
    },
  },
  {
    id: "security-org-name-mixed",
    tool: "securityScan",
    label: "실제 기관명처럼 보이는 값이 섞인 문안",
    sourceText:
      "홍보담당관은 2026-08-08 보도자료 초안을 작성했고 예산관리계장은 2026-08-09 이를 검토했다. 배포 대상 언론사 10곳 중 8곳은 확인을 완료했고 2곳은 승인이 미결이다. " +
      "초안 본문에는 [협력기관명]이 실제 정부 부처 명칭처럼 보이는 표현으로 그대로 기재돼 있어, 미승인 기관명 공개로 인한 오해·법적 위험이 있다는 지적이 나와 배포 전 승인 요청이 필요하다.",
    baselineResult: {
      title: "기관명 표기 보안검토",
      summary: "초안의 [협력기관명] 표기가 실제 정부 부처처럼 보여 오해·법적 위험이 있으므로 배포 전 승인이 필요하다.",
      sections: [
        { label: "위험수준", body: "중간 — 미승인 [협력기관명] 표기로 인한 오해·법적 위험." },
        { label: "탐지항목", body: "실제 정부 부처처럼 보이는 [협력기관명] 표기 1건." },
        { label: "사유", body: "승인되지 않은 기관명 표기는 해당 기관과의 오해나 법적 분쟁으로 이어질 수 있다." },
        { label: "권장 대체표현", body: "\"관계기관\" 등 일반화된 표현으로 대체." },
        { label: "안전한 재작성", body: "\"관계기관과 협력하여 추진했습니다.\"로 수정 제안." },
        { label: "최종 점검", body: "[협력기관명] 승인 여부를 확인한 뒤 배포 승인 절차를 진행한다." },
      ],
      actions: [
        { title: "기관명 표기 일반화 수정", owner: "홍보담당관", dueDate: "2026-08-10", risk: "medium" },
        { title: "미승인 2건 배포 승인 확인", owner: "예산관리계장", dueDate: "2026-08-11", risk: "high" },
      ],
    },
  },
];

export function examplesForTool(tool: PublicDocumentTool): PublicDocumentExample[] {
  return PUBLIC_DOCUMENT_EXAMPLES.filter((example) => example.tool === tool);
}

export function exampleById(id: string): PublicDocumentExample | undefined {
  return PUBLIC_DOCUMENT_EXAMPLES.find((example) => example.id === id);
}

export function isUnmodifiedExample(exampleId: string, sourceText: string): boolean {
  const example = exampleById(exampleId);
  return example !== undefined && example.sourceText === sourceText;
}
