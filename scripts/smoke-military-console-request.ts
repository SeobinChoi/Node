import assert from "node:assert/strict";
import {
    buildMilitaryAIRequestBody,
    DEFAULT_FIELD_VALUES,
    splitList,
} from "../lib/ai/military-console-request";

const projectId = "project-123";
const sourceText = "회의 결과와 후속 조치 메모";
const fields = {
    ...DEFAULT_FIELD_VALUES,
    audience: " ",
    constraints: "보안등급 제거\n요약 5줄, 담당자 포함",
    meetingTitle: "AI 실무 회의",
    attendees: "작전과장, 정보장교\n행정담당",
    trainingName: "AI 초안작성 훈련",
    unitLabel: " ",
    focusAreas: "안전, 개선사항\n후속조치",
    includeRiskReview: "false",
    weekOf: "2026-W27",
    commanderFocus: "위험요소, 다음주 계획\n지원 필요사항",
    contextType: "weekly_report",
    reviewMode: "quick",
};

assert.deepEqual(splitList(" alpha,\n beta ,,gamma "), ["alpha", "beta", "gamma"]);

assert.deepEqual(buildMilitaryAIRequestBody("adminDocument", projectId, sourceText, fields), {
    projectId,
    sourceText,
    documentType: "official_memo",
    audience: undefined,
    tone: "formal",
    constraints: ["보안등급 제거", "요약 5줄", "담당자 포함"],
});

assert.deepEqual(buildMilitaryAIRequestBody("meetingSummary", projectId, sourceText, fields), {
    projectId,
    sourceText,
    meetingTitle: "AI 실무 회의",
    attendees: ["작전과장", "정보장교", "행정담당"],
    summaryStyle: "minutes",
});

assert.deepEqual(buildMilitaryAIRequestBody("aarSummary", projectId, sourceText, fields), {
    projectId,
    sourceText,
    trainingName: "AI 초안작성 훈련",
    unitLabel: undefined,
    focusAreas: ["안전", "개선사항", "후속조치"],
    includeRiskReview: false,
});

assert.deepEqual(buildMilitaryAIRequestBody("weeklyReport", projectId, sourceText, fields), {
    projectId,
    sourceText,
    weekOf: "2026-W27",
    unitLabel: undefined,
    commanderFocus: ["위험요소", "다음주 계획", "지원 필요사항"],
});

assert.deepEqual(buildMilitaryAIRequestBody("securityScan", projectId, sourceText, fields), {
    projectId,
    text: sourceText,
    contextType: "weekly_report",
    reviewMode: "quick",
});

console.log("PASS military console request payload smoke");
