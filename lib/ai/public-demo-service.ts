import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
    generateMilitaryAIJson,
    scanMilitarySensitiveContent,
    type MilitaryAIResult,
} from "@/lib/ai/military-documents";

export type PublicDemoService = "militaryAi" | "opsRadar" | "adminDoc" | "afterAction";

export interface PublicDemoSection {
    label: string;
    body: string;
}

export interface PublicDemoWorkItem {
    title: string;
    owner: string;
    status: string;
    risk: "low" | "medium" | "high";
}

export interface PublicDemoMetric {
    label: string;
    value: string;
    note: string;
}

export interface PublicDemoResult {
    title: string;
    summary: string;
    sections: PublicDemoSection[];
    actions: string[];
    security: Array<{ label: string; status: "pass" | "review"; note: string }>;
    metrics: PublicDemoMetric[];
    workItems: PublicDemoWorkItem[];
    markdown: string;
    model: string;
    generatedKeys: string[];
    securityFlagCount: number;
}

interface DemoArtifactRow {
    id: string;
    service: string;
    title: string;
    summary: string;
    markdown: string;
    createdAt: Date | string;
}

export interface DemoArtifactSummary {
    id: string;
    service: string;
    title: string;
    summary: string;
    markdown: string;
    createdAt: string;
}

const DEMO_PROJECT_NAME = "Node 공개 시연 업무지원 플랫폼";

const SERVICE_LABELS: Record<PublicDemoService, string> = {
    militaryAi: "문서지원 통합 데모",
    opsRadar: "작전 과업 병목관리",
    adminDoc: "행정문서 작성지원",
    afterAction: "회의·훈련 사후조치",
};

const FALLBACK_METRICS: Record<PublicDemoService, PublicDemoMetric[]> = {
    militaryAi: [
        { label: "AI 도구", value: "5", note: "실연동" },
        { label: "저장", value: "DB", note: "시연 저장" },
        { label: "보안", value: "검토", note: "자동 점검" },
    ],
    opsRadar: [
        { label: "고위험", value: "2", note: "우선 조치" },
        { label: "지연과업", value: "4", note: "담당 확인" },
        { label: "보고가능", value: "11", note: "현황 유지" },
    ],
    adminDoc: [
        { label: "문서블록", value: "5", note: "보고 구조" },
        { label: "보안주의", value: "0", note: "더미 기준" },
        { label: "검토단계", value: "3", note: "제출 전" },
    ],
    afterAction: [
        { label: "교훈사항", value: "4", note: "유지/개선" },
        { label: "미결조치", value: "6", note: "추적 필요" },
        { label: "주간보고", value: "3", note: "보고 반영" },
    ],
};

const RESPONSE_SHAPES = {
    adminDocument: `{
  "title": "문서 제목",
  "summary": "3문장 이내 요약",
  "draft": "본문 초안",
  "sections": [{"heading": "항목명", "body": "항목별 본문"}],
  "missingInputs": ["추가 확인이 필요한 값"],
  "reviewChecklist": ["보안/사실/결재선 확인 항목"]
}`,
    meetingSummary: `{
  "title": "회의록 제목",
  "summary": "핵심 요약",
  "decisions": [{"decision": "결정 사항", "owner": "담당", "dueDate": "기한 또는 [미정]"}],
  "actionItems": [{"task": "조치", "owner": "담당", "dueDate": "기한 또는 [미정]", "risk": "위험"}],
  "sections": [{"heading": "회의 항목", "body": "정리 내용"}],
  "reviewChecklist": ["보안/참석자/결정사항 확인 항목"]
}`,
    aarSummary: `{
  "title": "사후검토 제목",
  "summary": "훈련/회의 결과 요약",
  "sustain": ["유지할 점"],
  "improve": ["개선할 점"],
  "actionItems": [{"task": "후속 조치", "owner": "담당", "dueDate": "기한 또는 [미정]"}],
  "sections": [{"heading": "분석 항목", "body": "내용"}],
  "reviewChecklist": ["사실/보안/개선계획 확인 항목"]
}`,
    weeklyReport: `{
  "title": "주간보고 제목",
  "summary": "주간 핵심 요약",
  "completed": ["완료 사항"],
  "inProgress": ["진행 중 사항"],
  "risks": [{"risk": "위험/이슈", "impact": "영향", "mitigation": "대응"}],
  "nextWeek": ["차주 계획"],
  "sections": [{"heading": "보고 항목", "body": "본문"}],
  "reviewChecklist": ["수치/보안/일정 확인 항목"]
}`,
    securityScan: `{
  "title": "보안 검토 요약",
  "summary": "제출 가능성 요약",
  "riskLevel": "low | medium | high",
  "recommendedRedactions": [{"category": "항목", "reason": "사유", "replacement": "권장 대체 표현"}],
  "safeRewrite": "민감정보를 일반화한 제출용 문장",
  "reviewChecklist": ["최종 확인 항목"]
}`,
};

const SYSTEM_PROMPTS = {
    adminDocument:
        "You draft Korean military administrative documents for a public no-login demo. Use only the provided dummy input, avoid real names/units/locations, and return review-ready JSON.",
    meetingSummary:
        "You prepare Korean meeting minutes for a public no-login demo. Preserve decisions and action ownership, mark unknown facts as [미정], and return review-ready JSON.",
    aarSummary:
        "You prepare Korean after-action summaries for a public no-login demo. Separate sustain/improve points, never invent facts, and return review-ready JSON.",
    weeklyReport:
        "You prepare Korean weekly situation reports for a public no-login demo. Convert raw updates into completed/in-progress/risk/next-week sections and return JSON.",
    securityScan:
        "You are a conservative Korean military document security reviewer for a public no-login demo. Recommend generalized replacements without revealing sensitive values.",
};

const TOOL_INSTRUCTIONS = {
    adminDocument: "Create a military administrative document draft that can be reviewed by a human officer.",
    meetingSummary: "Summarize notes into decisions, action items, open questions, and review checks.",
    aarSummary: "Create a meeting or training after-action review summary from notes and observations.",
    weeklyReport: "Create a weekly situation report from project and unit notes.",
    securityScan: "Review this text for public demo submission safety and provide a safer rewrite.",
};

const ACTION_KEYS = [
    "actions",
    "actionItems",
    "reviewChecklist",
    "missingInputs",
    "completed",
    "inProgress",
    "nextWeek",
] as const;

export function normalizeDemoService(value: string): PublicDemoService {
    if (value === "militaryAi" || value === "opsRadar" || value === "adminDoc" || value === "afterAction") {
        return value;
    }

    return "adminDoc";
}

function textValue(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringifyValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        const primary = textValue(
            record.task,
            textValue(record.action, textValue(record.decision, textValue(record.risk, textValue(record.category, "")))),
        );
        const owner = textValue(record.owner);
        const dueDate = textValue(record.dueDate);
        const reason = textValue(record.reason);
        const impact = textValue(record.impact);
        const mitigation = textValue(record.mitigation);

        if (primary) {
            return [
                primary,
                owner ? `담당 ${owner}` : "",
                dueDate ? `기한 ${dueDate}` : "",
                reason ? `사유 ${reason}` : "",
                impact ? `영향 ${impact}` : "",
                mitigation ? `대응 ${mitigation}` : "",
            ].filter(Boolean).join(" / ");
        }

        return JSON.stringify(value);
    }
    return "";
}

function arrayValues(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(stringifyValue).filter(Boolean).slice(0, 8);
}

function sectionsFromGenerated(generated: Record<string, unknown>): PublicDemoSection[] {
    const rawSections = generated.sections;
    if (Array.isArray(rawSections)) {
        const sections = rawSections
            .map((section) => {
                if (!section || typeof section !== "object") return null;
                const record = section as Record<string, unknown>;
                return {
                    label: textValue(record.heading, textValue(record.label, "정리 항목")),
                    body: textValue(record.body, stringifyValue(section)),
                };
            })
            .filter((section): section is PublicDemoSection => Boolean(section))
            .slice(0, 5);
        if (sections.length > 0) return sections;
    }

    return Object.entries(generated)
        .filter(([key, value]) => !["title", "summary", "reviewChecklist", "sections"].includes(key) && value)
        .slice(0, 4)
        .map(([key, value]) => ({
            label: key,
            body: Array.isArray(value) ? value.map(stringifyValue).join("\n") : stringifyValue(value),
        }));
}

function actionsFromGenerated(generated: Record<string, unknown>): string[] {
    for (const key of ACTION_KEYS) {
        const values = arrayValues(generated[key]);
        if (values.length > 0) return values;
    }

    return ["담당자 검토", "민감정보 재확인", "저장 후 시연 결과 확인"];
}

function workItemsFromActions(actions: string[], service: PublicDemoService): PublicDemoWorkItem[] {
    const owners = service === "opsRadar"
        ? ["작전계획반", "군수반", "참모부", "교육훈련반"]
        : ["문서 담당", "검토 담당", "보안 담당", "보고 담당"];
    const risks: Array<PublicDemoWorkItem["risk"]> = ["medium", "high", "low", "medium"];

    return actions.slice(0, 4).map((action, index) => ({
        title: action.length > 44 ? `${action.slice(0, 44)}...` : action,
        owner: owners[index % owners.length],
        status: index === 0 ? "조치" : index === 1 ? "검토" : "대기",
        risk: risks[index % risks.length],
    }));
}

function sourceExcerpt(sourceText: string): string {
    const normalized = sourceText.trim().replace(/\s+/g, " ");
    return normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized;
}

function isParseFallback(generated: Record<string, unknown>): boolean {
    return textValue(generated.title) === "AI response parsing failed";
}

function fallbackGeneratedForService({
    service,
    tool,
    mode,
    sourceText,
}: {
    service: PublicDemoService;
    tool: keyof typeof RESPONSE_SHAPES;
    mode: string;
    sourceText: string;
}): Record<string, unknown> {
    const excerpt = sourceExcerpt(sourceText);

    if (service === "afterAction") {
        return {
            title: mode === "weekly" ? "사후조치 주간상황보고 초안" : "회의·훈련 사후조치 요약",
            summary: `입력 메모를 사후조치, 개선사항, 차주 보고 항목으로 분리했습니다. 입력 요약: ${excerpt}`,
            sections: [
                { heading: "유지할 점", body: "현황 공유와 담당 부서 분리는 유지합니다." },
                { heading: "개선할 점", body: "입력 마감과 위험요인 등록 기준을 사전에 고정합니다." },
                { heading: "차주 반영", body: "미결 조치는 주간상황보고의 진행 항목으로 추적합니다." },
            ],
            actionItems: [
                { task: "입력 마감 D-3 기준 적용", owner: "교육훈련반", dueDate: "[미정]" },
                { task: "위험요인 등록 양식 표준화", owner: "작전계획반", dueDate: "[미정]" },
                { task: "사후조치 결과 주간보고 반영", owner: "보고 담당", dueDate: "[미정]" },
            ],
            reviewChecklist: ["실제 훈련명 비식별 확인", "담당 부서 표기 확인", "일정 확정값 확인"],
        };
    }

    if (tool === "securityScan") {
        return {
            title: "제출 전 보안 검토 요약",
            summary: `공개 시연 입력 기준으로 민감정보 포함 여부를 점검했습니다. 입력 요약: ${excerpt}`,
            riskLevel: "medium",
            recommendedRedactions: [
                { category: "부대·위치", reason: "실제 값 입력 가능성", replacement: "[부대명] / [장소]" },
                { category: "담당자", reason: "개인정보 보호", replacement: "[담당자]" },
            ],
            safeRewrite: "실제 부대명, 담당자명, 장소, 세부 일정은 일반화해 제출용 문장으로 정리합니다.",
            reviewChecklist: ["실명 제거", "위치·일정 일반화", "첨부파일명 재확인"],
        };
    }

    if (tool === "weeklyReport") {
        return {
            title: "주간상황보고 초안",
            summary: `입력 메모를 완료, 진행, 위험, 차주 계획으로 분류했습니다. 입력 요약: ${excerpt}`,
            completed: ["회의 결과 정리", "담당 부서별 확인 항목 분리"],
            inProgress: ["점검표 회수", "일정 조정", "위험 항목 추적"],
            risks: [
                { risk: "미확정 일정", impact: "보고 지연 가능", mitigation: "D-3 기준으로 확정값 재확인" },
            ],
            nextWeek: ["미결 항목 회수", "보고 문안 검토", "보안 표현 재점검"],
            reviewChecklist: ["수치 사실 확인", "실제 부대명 제거", "차주 일정 확인"],
        };
    }

    if (tool === "meetingSummary") {
        return {
            title: "회의록 요약 초안",
            summary: `입력 메모를 결정사항과 후속조치로 정리했습니다. 입력 요약: ${excerpt}`,
            decisions: [
                { decision: "지연 항목을 별도 추적", owner: "보고 담당", dueDate: "[미정]" },
            ],
            actionItems: [
                { task: "미제출 항목 회수", owner: "군수반", dueDate: "[미정]", risk: "medium" },
                { task: "안전 통제 인원 확인", owner: "작전계획반", dueDate: "[미정]", risk: "medium" },
            ],
            sections: [
                { heading: "결정사항", body: "보고 전 미결 항목을 분리하고 담당 부서를 지정합니다." },
                { heading: "미결사항", body: "일정, 통제 인원, 점검표 회수 여부를 재확인합니다." },
            ],
            reviewChecklist: ["참석자 실명 제거", "결정사항 사실 확인", "기한 확정값 확인"],
        };
    }

    return {
        title: service === "militaryAi" ? "행정문서 초안" : "합동 점검 준비 보고 초안",
        summary: `입력 메모를 보고 목적, 주요 경과, 미결사항, 조치계획으로 정리했습니다. 입력 요약: ${excerpt}`,
        draft: "합동 점검 준비 현황을 보고하며, 미제출 점검표와 일정 조정 사항은 담당 부서 확인 후 확정합니다.",
        sections: [
            { heading: "보고 목적", body: "준비 현황과 지연 항목을 지휘 계통에 간결히 공유합니다." },
            { heading: "주요 경과", body: "점검표 회수, 일정 조정, 안전 통제 인원 확인이 진행 중입니다." },
            { heading: "조치 계획", body: "미결 항목을 담당 부서별로 배정하고 제출 전 보안 문구를 재검토합니다." },
        ],
        missingInputs: ["최종 일정", "담당 부서 확정값", "제출용 비식별 표현"],
        reviewChecklist: ["실제 부대명 제거", "담당자 실명 제거", "결재선 확인", "첨부 증빙 보안 검토"],
    };
}

function markdownFromResult(service: PublicDemoService, result: Omit<PublicDemoResult, "markdown">): string {
    const sections = result.sections.map((section) => `## ${section.label}\n${section.body}`).join("\n\n");
    const actions = result.actions.map((action) => `- ${action}`).join("\n");
    const security = result.security.map((item) => `- ${item.label}: ${item.note}`).join("\n");

    return `# ${result.title}

서비스: ${SERVICE_LABELS[service]}
모델: ${result.model}

${result.summary}

${sections}

## 후속조치
${actions}

## 보안 검토
${security}
`;
}

function opsRadarResult(sourceText: string, mode: string): PublicDemoResult {
    const highSignals = ["지연", "미확정", "위험", "대기", "승인"].filter((word) => sourceText.includes(word)).length;
    const sourceLengthScore = Math.min(9, Math.max(3, Math.ceil(sourceText.trim().length / 45)));
    const highRisk = Math.max(1, highSignals);
    const delayed = Math.max(2, sourceLengthScore - 1);
    const reportable = Math.max(6, 14 - delayed);
    const modeLabel = mode === "owner" ? "담당 기준" : mode === "timeline" ? "일정 기준" : "위험도 기준";
    const actions = [
        `${modeLabel}으로 고위험 과업 ${highRisk}건을 우선 확인`,
        "장비 점검표와 안전 통제 인원 배치를 선행조건으로 고정",
        "주간보고 전 미확정 항목을 별도 추적 목록으로 저장",
    ];
    const partial: Omit<PublicDemoResult, "markdown"> = {
        title: "병목 재계산 결과",
        summary: `${modeLabel} 분석 결과, 지연 신호 ${delayed}건과 고위험 과업 ${highRisk}건을 분리했다. 입력 메모는 공개 시연용 더미 데이터로 처리했다.`,
        sections: [
            {
                label: "우선 조치",
                body: "점검표 취합, 통제 인원 확정, 대체 일정 검토를 같은 마감선에 묶어 병목을 줄인다.",
            },
            {
                label: "노드 연결",
                body: "지연 원인 노드는 주간상황보고와 안전 통제 노드의 선행조건으로 연결한다.",
            },
        ],
        actions,
        security: [
            { label: "공개 시연", status: "pass", note: "실제 부대명, 좌표, 담당자명 없이 처리" },
            { label: "입력 검토", status: highSignals > 2 ? "review" : "pass", note: "실제 제출 전 민감표현 재확인" },
        ],
        metrics: [
            { label: "고위험", value: String(highRisk), note: "우선 조치" },
            { label: "지연과업", value: String(delayed), note: "담당 확인" },
            { label: "보고가능", value: String(reportable), note: "현황 유지" },
        ],
        workItems: workItemsFromActions(actions, "opsRadar"),
        model: "deterministic-demo-engine",
        generatedKeys: ["title", "summary", "sections", "actions", "metrics", "workItems"],
        securityFlagCount: scanMilitarySensitiveContent([sourceText]).length,
    };

    return {
        ...partial,
        markdown: markdownFromResult("opsRadar", partial),
    };
}

function resolveTool(service: PublicDemoService, tool: string, mode: string): keyof typeof RESPONSE_SHAPES {
    if (service === "militaryAi") {
        if (tool in RESPONSE_SHAPES) return tool as keyof typeof RESPONSE_SHAPES;
        return "adminDocument";
    }

    if (service === "adminDoc") {
        return mode === "security" ? "securityScan" : "adminDocument";
    }

    if (service === "afterAction") {
        if (mode === "weekly") return "weeklyReport";
        if (mode === "actions") return "meetingSummary";
        return "aarSummary";
    }

    return "adminDocument";
}

export async function generatePublicDemoResult({
    service,
    tool = "",
    mode = "",
    sourceText,
}: {
    service: PublicDemoService;
    tool?: string;
    mode?: string;
    sourceText: string;
}): Promise<PublicDemoResult> {
    if (service === "opsRadar") {
        return opsRadarResult(sourceText, mode);
    }

    const resolvedTool = resolveTool(service, tool, mode);
    let generated: MilitaryAIResult;
    try {
        generated = await generateMilitaryAIJson({
            projectName: DEMO_PROJECT_NAME,
            sourceText,
            systemPrompt: SYSTEM_PROMPTS[resolvedTool],
            userInstruction: TOOL_INSTRUCTIONS[resolvedTool],
            responseShape: RESPONSE_SHAPES[resolvedTool],
            metadata: {
                publicDemo: true,
                service,
                mode,
                tool: resolvedTool,
                noLogin: true,
            },
            temperature: resolvedTool === "securityScan" ? 0.2 : 0.25,
            maxTokens: 1400,
        });
    } catch {
        generated = {
            generated: fallbackGeneratedForService({
                service,
                tool: resolvedTool,
                mode,
                sourceText,
            }),
            securityFlags: scanMilitarySensitiveContent([sourceText]),
            model: "deterministic-demo-fallback",
        };
    }
    let effectiveGenerated = generated.generated;

    if (isParseFallback(effectiveGenerated)) {
        effectiveGenerated = fallbackGeneratedForService({
            service,
            tool: resolvedTool,
            mode,
            sourceText,
        });
        generated = {
            ...generated,
            generated: effectiveGenerated,
        };
    }

    const title = textValue(effectiveGenerated.title, SERVICE_LABELS[service]);
    const summary = textValue(effectiveGenerated.summary, "입력 내용을 공개 시연용 결과로 정리했습니다.");
    const actions = actionsFromGenerated(effectiveGenerated);
    const sections = sectionsFromGenerated(effectiveGenerated);
    const localFlags = scanMilitarySensitiveContent([sourceText]);
    const partial: Omit<PublicDemoResult, "markdown"> = {
        title,
        summary,
        sections: sections.length > 0 ? sections : [{ label: "요약", body: summary }],
        actions,
        security: [
            {
                label: "민감정보 자동 점검",
                status: localFlags.length === 0 ? "pass" : "review",
                note: localFlags.length === 0 ? "더미 입력 기준 탐지 항목 없음" : `${localFlags.length}개 항목 검토 필요`,
            },
            { label: "공개 시연", status: "pass", note: "로그인 없이 더미 데이터로만 동작" },
        ],
        metrics: FALLBACK_METRICS[service],
        workItems: workItemsFromActions(actions, service),
        model: generated.model,
        generatedKeys: Object.keys(effectiveGenerated),
        securityFlagCount: generated.securityFlags.length,
    };

    return {
        ...partial,
        markdown: markdownFromResult(service, partial),
    };
}

let demoTableReady = false;

async function ensureDemoArtifactTable() {
    if (demoTableReady) return;

    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public_demo_artifacts (
            id TEXT PRIMARY KEY,
            service TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            source_text TEXT NOT NULL,
            result_json JSONB NOT NULL,
            markdown TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS public_demo_artifacts_service_created_at_idx
        ON public_demo_artifacts (service, created_at DESC)
    `);

    demoTableReady = true;
}

export async function saveDemoArtifact({
    service,
    sourceText,
    result,
}: {
    service: PublicDemoService;
    sourceText: string;
    result: PublicDemoResult;
}): Promise<DemoArtifactSummary> {
    await ensureDemoArtifactTable();
    const id = randomUUID();
    const resultJson = JSON.stringify(result);

    await prisma.$executeRaw`
        INSERT INTO public_demo_artifacts (id, service, title, summary, source_text, result_json, markdown)
        VALUES (${id}, ${service}, ${result.title}, ${result.summary}, ${sourceText}, CAST(${resultJson} AS jsonb), ${result.markdown})
    `;

    return {
        id,
        service,
        title: result.title,
        summary: result.summary,
        markdown: result.markdown,
        createdAt: new Date().toISOString(),
    };
}

export async function listDemoArtifacts(service?: PublicDemoService, limit = 8): Promise<DemoArtifactSummary[]> {
    await ensureDemoArtifactTable();
    const boundedLimit = Math.min(Math.max(limit, 1), 20);
    const blockedTitle = "AI response parsing failed";
    const rows = service
        ? await prisma.$queryRaw<DemoArtifactRow[]>`
            SELECT id, service, title, summary, markdown, created_at AS "createdAt"
            FROM public_demo_artifacts
            WHERE service = ${service} AND title <> ${blockedTitle}
            ORDER BY created_at DESC
            LIMIT ${boundedLimit}
        `
        : await prisma.$queryRaw<DemoArtifactRow[]>`
            SELECT id, service, title, summary, markdown, created_at AS "createdAt"
            FROM public_demo_artifacts
            WHERE title <> ${blockedTitle}
            ORDER BY created_at DESC
            LIMIT ${boundedLimit}
        `;

    return rows.map((row) => {
        const createdAt = row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString();

        return {
            id: row.id,
            service: row.service,
            title: row.title,
            summary: row.summary,
            markdown: row.markdown,
            createdAt,
        };
    });
}
