import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
    generateMilitaryAIJson,
    scanMilitarySensitiveContent,
    type MilitaryAIResult,
} from "@/lib/ai/military-documents";
import {
    exampleById,
    isUnmodifiedExample,
    type PublicDocumentTool,
} from "@/lib/demo/public-document-examples";

export type PublicDemoService = "militaryAi" | "opsRadar" | "adminDoc" | "afterAction";

export interface PublicDemoSection {
    label: string;
    body: string;
}

export interface PublicDemoWorkItem {
    title: string;
    owner: string;
    dueDate: string;
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
    sourceText?: string;
    createdAt: Date | string;
}

export interface DemoArtifactSummary {
    id: string;
    service: string;
    title: string;
    summary: string;
    markdown: string;
    sourceText?: string;
    createdAt: string;
}

const DEMO_PROJECT_NAME = "Node 공개 시연 업무지원 플랫폼";

const SERVICE_LABELS: Record<PublicDemoService, string> = {
    militaryAi: "문서지원 통합 데모",
    opsRadar: "작전 과업 병목관리",
    adminDoc: "행정문서 작성지원",
    afterAction: "회의·훈련 사후조치",
};

const RESPONSE_SHAPES = {
    adminDocument: `{
  "title": "문서 제목",
  "summary": "3문장 이내 요약",
  "draft": "본문 초안",
  "sections": [{"heading": "보고 목적 | 현황 | 문제점 | 조치계획 | 미확정값 | 검토항목 중 하나", "body": "항목별 본문"}],
  "missingInputs": ["추가 확인이 필요한 값"],
  "reviewChecklist": ["보안/사실/결재선 확인 항목"]
}`,
    approvalDocument: `{
  "title": "결재문서 제목",
  "summary": "결재 요지 3문장 이내 요약",
  "sections": [{"heading": "결재 요지 | 추진 근거 | 요청사항 | 일정·비용 | 검토·승인 조건 중 하나", "body": "항목별 본문"}],
  "missingInputs": ["추가 확인이 필요한 값"],
  "reviewChecklist": ["결재선/예산/일정 확인 항목"]
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
    opsRadarReport: `{
  "title": "보고서 제목",
  "summary": "현재 상황과 핵심 병목 요약",
  "sections": [{"heading": "항목명", "body": "항목별 본문"}],
  "actionItems": [{"task": "조치", "owner": "담당 부서", "dueDate": "기한 또는 [미정]"}],
  "reviewChecklist": ["보고 전 확인 항목"]
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
        "You draft Korean military administrative status report documents (보고서: 보고 목적/현황/문제점/조치계획) for a public no-login demo. Use only the provided dummy input, avoid real names/units/locations, and return review-ready JSON.",
    approvalDocument:
        "You draft Korean approval request documents (결재문서: 결재 요지/추진 근거/요청사항/일정·비용/검토·승인 조건) for a public no-login demo. This is a decision request, not a status report — focus on what is being requested and why, use only the provided dummy input, avoid real names/units/locations, and return review-ready JSON.",
    meetingSummary:
        "You prepare Korean meeting minutes for a public no-login demo. Preserve decisions and action ownership, mark unknown facts as [미정], and return review-ready JSON.",
    aarSummary:
        "You prepare Korean after-action summaries for a public no-login demo. Separate sustain/improve points, never invent facts, and return review-ready JSON.",
    weeklyReport:
        "You prepare Korean weekly situation reports for a public no-login demo. Convert raw updates into completed/in-progress/risk/next-week sections and return JSON.",
    securityScan:
        "You are a conservative Korean military document security reviewer for a public no-login demo. Recommend generalized replacements without revealing sensitive values.",
    opsRadarReport:
        "You write Korean unit operations reports for a public no-login demo. The input is a synthetic task dependency graph with computed statuses and bottlenecks; keep every task title, owner and date exactly as given, never invent facts, and return review-ready JSON.",
};

const TOOL_INSTRUCTIONS = {
    adminDocument: "Create a military administrative status report draft (보고 목적, 현황, 문제점, 조치계획, 미확정값, 검토항목) that can be reviewed by a human officer.",
    approvalDocument: "Create an approval request draft (결재 요지, 추진 근거, 요청사항, 일정·비용, 검토·승인 조건). Do not reuse the status-report structure.",
    meetingSummary: "Summarize notes into decisions, action items, open questions, and review checks.",
    aarSummary: "Create a meeting or training after-action review summary from notes and observations.",
    weeklyReport: "Create a weekly situation report from project and unit notes.",
    securityScan: "Review this text for public demo submission safety and provide a safer rewrite.",
    opsRadarReport: "Turn the evaluated task graph into a Korean operations report.",
};

const OPS_RADAR_DOCUMENT_INSTRUCTIONS: Record<string, string> = {
    command: "보고서 유형은 지휘관 상황보고입니다. 현재 상황, 핵심 병목과 영향, 지휘 판단이 필요한 사항 순으로 작성하세요.",
    action: "보고서 유형은 병목 조치계획입니다. 병목별 원인, 담당 부서, 기한, 조치 방법을 중심으로 작성하세요.",
    weekly: "보고서 유형은 주간 진행보고입니다. 완료 사항, 진행 사항, 위험 요인, 차주 계획 순으로 작성하세요.",
};

const opsRadarInstruction = (mode: string) =>
    `${TOOL_INSTRUCTIONS.opsRadarReport} ${OPS_RADAR_DOCUMENT_INSTRUCTIONS[mode] ?? OPS_RADAR_DOCUMENT_INSTRUCTIONS.command}`;

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
    if (!Array.isArray(rawSections)) return [];

    return rawSections
        .map((section) => {
            if (!section || typeof section !== "object") return null;
            const record = section as Record<string, unknown>;
            return {
                label: textValue(record.heading, textValue(record.label, "정리 항목")),
                body: textValue(record.body, stringifyValue(section)),
            };
        })
        .filter((section): section is PublicDemoSection => Boolean(section));
}

function securitySectionsFromGenerated(generated: Record<string, unknown>): PublicDemoSection[] {
    const redactions = Array.isArray(generated.recommendedRedactions)
        ? (generated.recommendedRedactions as Record<string, unknown>[])
        : [];
    const categories = redactions.map((item) => textValue(item.category)).filter(Boolean).join(", ");
    const reasons = redactions.map((item) => textValue(item.reason)).filter(Boolean).join(" ");
    const replacements = redactions.map((item) => textValue(item.replacement)).filter(Boolean).join(", ");

    return [
        { label: "위험수준", body: textValue(generated.riskLevel, "[미정]") },
        { label: "탐지항목", body: categories || "[미정]" },
        { label: "사유", body: reasons || "[미정]" },
        { label: "권장 대체표현", body: replacements || "[미정]" },
        { label: "안전한 재작성", body: textValue(generated.safeRewrite, "[미정]") },
        { label: "최종 점검", body: arrayValues(generated.reviewChecklist).join(" / ") || "[미정]" },
    ];
}

function actionsFromGenerated(generated: Record<string, unknown>): string[] {
    for (const key of ACTION_KEYS) {
        const values = arrayValues(generated[key]);
        if (values.length > 0) return values;
    }

    return ["담당자 검토", "민감정보 재확인", "저장 후 시연 결과 확인"];
}

const STRUCTURED_ACTION_KEYS = ["actionItems", "decisions", "risks"] as const;
const VALID_RISKS: ReadonlyArray<PublicDemoWorkItem["risk"]> = ["low", "medium", "high"];

interface GeneratedActionRecord {
    title: string;
    owner?: string;
    dueDate?: string;
    risk?: string;
}

function structuredActionRecords(generated: Record<string, unknown>): GeneratedActionRecord[] {
    for (const key of STRUCTURED_ACTION_KEYS) {
        const raw = generated[key];
        if (!Array.isArray(raw) || raw.length === 0) continue;

        const records = raw
            .map((item): GeneratedActionRecord | null => {
                if (!item || typeof item !== "object") return null;
                const record = item as Record<string, unknown>;
                const title = textValue(record.task, textValue(record.decision, textValue(record.risk, "")));
                if (!title) return null;

                return {
                    title,
                    owner: textValue(record.owner) || undefined,
                    dueDate: textValue(record.dueDate) || undefined,
                    risk: textValue(record.risk) || undefined,
                };
            })
            .filter((record): record is GeneratedActionRecord => record !== null);

        if (records.length > 0) return records;
    }

    return [];
}

function workItemsFromGenerated(generated: Record<string, unknown>, actions: string[]): PublicDemoWorkItem[] {
    const structured = structuredActionRecords(generated);
    const source: GeneratedActionRecord[] = structured.length > 0
        ? structured
        : actions.map((title) => ({ title }));

    return source.slice(0, 4).map((item, index) => ({
        title: item.title.length > 44 ? `${item.title.slice(0, 44)}...` : item.title,
        owner: item.owner ?? "[미정]",
        dueDate: item.dueDate ?? "[미정]",
        status: index === 0 ? "조치" : index === 1 ? "검토" : "대기",
        risk: VALID_RISKS.includes(item.risk as PublicDemoWorkItem["risk"])
            ? (item.risk as PublicDemoWorkItem["risk"])
            : "medium",
    }));
}

function metricsFromResult({
    sections,
    actions,
    securityFlagCount,
}: {
    sections: PublicDemoSection[];
    actions: string[];
    securityFlagCount: number;
}): PublicDemoMetric[] {
    return [
        { label: "구성 항목", value: String(sections.length), note: "결과 섹션 수" },
        { label: "후속조치", value: String(actions.length), note: "조치·확인 항목 수" },
        { label: "보안 플래그", value: String(securityFlagCount), note: securityFlagCount === 0 ? "탐지 없음" : "검토 필요" },
    ];
}


function needsDeterministicFallback(
    generated: Record<string, unknown>,
    service: PublicDemoService,
    tool: keyof typeof RESPONSE_SHAPES,
): boolean {
    if (textValue(generated.title) === "AI response parsing failed") return true;
    if (service !== "opsRadar" || tool !== "opsRadarReport") return false;
    return !textValue(generated.title) || !textValue(generated.summary)
        || arrayValues(generated.sections).length === 0
        || arrayValues(generated.actionItems).length === 0;
}

function opsRadarDeterministicFallback({ mode, sourceText }: { mode: string; sourceText: string }): Record<string, unknown> {
    const documentLabel = mode === "weekly" ? "주간 진행보고" : mode === "action" ? "병목 조치계획" : "지휘관 상황보고";
    const lines = sourceText.split("\n");
    const line = (prefix: string) => lines.find((item) => item.startsWith(prefix))?.replace(/^metrics:\s*|^-\s*/, "");
    const after = (heading: string) => {
        const index = lines.indexOf(heading);
        return index >= 0 ? lines[index + 1]?.replace(/^-\s*/, "") : undefined;
    };
    const metrics = line("metrics:") ?? "평가 지표 없음";
    const bottleneck = after(lines.find((item) => item.startsWith("bottlenecks (")) ?? "") ?? "즉시 조치가 필요한 병목 없음";
    const recommendation = after("recommendations:") ?? "현재 업무 상태를 유지하며 재평가";
    return {
        title: `${documentLabel} 초안`,
        summary: `평가된 현재 과업 관계를 기준으로 정리했습니다. ${metrics}.`,
        sections: [
            { heading: "현재 상황", body: metrics },
            { heading: "핵심 병목", body: bottleneck },
            { heading: "우선 조치", body: recommendation },
        ],
        actionItems: [recommendation],
        reviewChecklist: ["실제 부대명 제거", "담당 부서 표기 확인", "기한 확정값 확인"],
    };
}

export class PublicDemoGenerationError extends Error {}
export class PublicDemoSensitiveInputError extends Error {}

const SectionShapeSchema = z.object({
    heading: z.string().optional(),
    label: z.string().optional(),
    body: z.string().min(1),
});

const TitleSummaryShape = {
    title: z.string().min(1),
    summary: z.string().min(1),
};

const CATALOG_TOOL_SCHEMAS: Record<PublicDocumentTool, z.ZodTypeAny> = {
    adminDocument: z.object({
        ...TitleSummaryShape,
        sections: z.array(SectionShapeSchema).min(1),
    }).passthrough(),
    approvalDocument: z.object({
        ...TitleSummaryShape,
        sections: z.array(SectionShapeSchema).min(1),
    }).passthrough(),
    meetingSummary: z
        .object({
            ...TitleSummaryShape,
            sections: z.array(SectionShapeSchema).min(1),
            decisions: z
                .array(z.object({ decision: z.string().min(1), owner: z.string().optional(), dueDate: z.string().optional() }))
                .optional(),
            actionItems: z
                .array(z.object({
                    task: z.string().min(1),
                    owner: z.string().optional(),
                    dueDate: z.string().optional(),
                    risk: z.string().optional(),
                }))
                .optional(),
        }).passthrough()
        .refine((value) => (value.decisions?.length ?? 0) + (value.actionItems?.length ?? 0) > 0, {
            message: "meetingSummary requires decisions or actionItems",
        }),
    aarSummary: z
        .object({
            ...TitleSummaryShape,
            sections: z.array(SectionShapeSchema).min(1),
            sustain: z.array(z.string()).optional(),
            improve: z.array(z.string()).optional(),
            actionItems: z
                .array(z.object({ task: z.string().min(1), owner: z.string().optional(), dueDate: z.string().optional(), risk: z.string().optional() }))
                .optional(),
        }).passthrough()
        .refine((value) => (value.sustain?.length ?? 0) + (value.improve?.length ?? 0) > 0, {
            message: "aarSummary requires sustain or improve",
        }),
    weeklyReport: z
        .object({
            ...TitleSummaryShape,
            sections: z.array(SectionShapeSchema).min(1),
            completed: z.array(z.string()).optional(),
            inProgress: z.array(z.string()).optional(),
            risks: z
                .array(z.object({ risk: z.string().min(1), impact: z.string().optional(), mitigation: z.string().optional() }))
                .optional(),
            nextWeek: z.array(z.string()).optional(),
        }).passthrough()
        .refine((value) => (value.completed?.length ?? 0) + (value.inProgress?.length ?? 0) > 0, {
            message: "weeklyReport requires completed or inProgress",
        }),
    securityScan: z.object({
        ...TitleSummaryShape,
        riskLevel: z.string().min(1),
        recommendedRedactions: z
            .array(z.object({ category: z.string().min(1), reason: z.string().optional(), replacement: z.string().optional() }))
            .min(1),
        safeRewrite: z.string().min(1),
    }).passthrough(),
};

function validatedGeneratedForCatalogTool(
    tool: PublicDocumentTool,
    generated: Record<string, unknown>,
): Record<string, unknown> | null {
    const parsed = CATALOG_TOOL_SCHEMAS[tool].safeParse(generated);
    return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}

function honestFallbackOrThrow({
    tool,
    exampleId,
    sourceText,
}: {
    tool: PublicDocumentTool;
    exampleId?: string;
    sourceText: string;
}): { generated: Record<string, unknown>; model: string } {
    const example = exampleId ? exampleById(exampleId) : undefined;

    if (example && example.tool === tool && isUnmodifiedExample(exampleId as string, sourceText)) {
        return {
            generated: {
                title: example.baselineResult.title,
                summary: example.baselineResult.summary,
                sections: example.baselineResult.sections.map((section) => ({ heading: section.label, body: section.body })),
                actionItems: example.baselineResult.actions.map((action) => ({
                    task: action.title,
                    owner: action.owner,
                    dueDate: action.dueDate,
                    risk: action.risk,
                })),
            },
            model: "curated-sample-fallback",
        };
    }

    throw new PublicDemoGenerationError(
        "Public demo generation failed and no unmodified example fallback is available for this input.",
    );
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


function resolveTool(service: PublicDemoService, tool: string, mode: string): keyof typeof RESPONSE_SHAPES {
    if (service === "militaryAi") {
        if (tool in RESPONSE_SHAPES) return tool as keyof typeof RESPONSE_SHAPES;
        return "adminDocument";
    }

    if (service === "adminDoc") {
        if (mode === "approval") return "approvalDocument";
        if (mode === "security") return "securityScan";
        return "adminDocument";
    }

    if (service === "opsRadar") {
        return "opsRadarReport";
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
    exampleId,
}: {
    service: PublicDemoService;
    tool?: string;
    mode?: string;
    sourceText: string;
    exampleId?: string;
}): Promise<PublicDemoResult> {
    const resolvedTool = resolveTool(service, tool, mode);
    const isOpsRadar = resolvedTool === "opsRadarReport";
    const localFlags = scanMilitarySensitiveContent([sourceText]);
    const isCatalogExample = Boolean(exampleId && isUnmodifiedExample(exampleId, sourceText));

    if (localFlags.length > 0 && !isCatalogExample) {
        throw new PublicDemoSensitiveInputError("실제 민감정보로 보이는 입력은 외부 AI로 전송하지 않습니다. 비식별 합성 데이터로 바꿔 주세요.");
    }

    let effectiveGenerated: Record<string, unknown>;
    let effectiveModel: string;

    try {
        const generated: MilitaryAIResult = await generateMilitaryAIJson({
            projectName: DEMO_PROJECT_NAME,
            sourceText,
            provider: "gemini",
            systemPrompt: SYSTEM_PROMPTS[resolvedTool],
            userInstruction: isOpsRadar ? opsRadarInstruction(mode) : TOOL_INSTRUCTIONS[resolvedTool],
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

        if (isOpsRadar) {
            if (needsDeterministicFallback(generated.generated, service, resolvedTool)) {
                effectiveGenerated = opsRadarDeterministicFallback({ mode, sourceText });
                effectiveModel = "deterministic-demo-fallback";
            } else {
                effectiveGenerated = generated.generated;
                effectiveModel = generated.model;
            }
        } else {
            const validated = validatedGeneratedForCatalogTool(resolvedTool, generated.generated);
            if (validated) {
                effectiveGenerated = validated;
                effectiveModel = generated.model;
            } else {
                const fallback = honestFallbackOrThrow({ tool: resolvedTool, exampleId, sourceText });
                effectiveGenerated = fallback.generated;
                effectiveModel = fallback.model;
            }
        }
    } catch (error) {
        if (error instanceof PublicDemoGenerationError) throw error;

        if (isOpsRadar) {
            effectiveGenerated = opsRadarDeterministicFallback({ mode, sourceText });
            effectiveModel = "deterministic-demo-fallback";
        } else {
            const fallback = honestFallbackOrThrow({ tool: resolvedTool, exampleId, sourceText });
            effectiveGenerated = fallback.generated;
            effectiveModel = fallback.model;
        }
    }

    const title = textValue(effectiveGenerated.title, SERVICE_LABELS[service]);
    const summary = textValue(effectiveGenerated.summary, "입력 내용을 공개 시연용 결과로 정리했습니다.");
    const actions = actionsFromGenerated(effectiveGenerated);
    const sections = resolvedTool === "securityScan" && effectiveModel !== "curated-sample-fallback"
        ? securitySectionsFromGenerated(effectiveGenerated)
        : sectionsFromGenerated(effectiveGenerated);
    const resolvedSections = sections.length > 0 ? sections : [{ label: "요약", body: summary }];
    const partial: Omit<PublicDemoResult, "markdown"> = {
        title,
        summary,
        sections: resolvedSections,
        actions,
        security: [
            {
                label: "민감정보 자동 점검",
                status: localFlags.length === 0 ? "pass" : "review",
                note: localFlags.length === 0 ? "더미 입력 기준 탐지 항목 없음" : `${localFlags.length}개 항목 검토 필요`,
            },
            { label: "공개 시연", status: "pass", note: "로그인 없이 더미 데이터로만 동작" },
        ],
        metrics: metricsFromResult({ sections: resolvedSections, actions, securityFlagCount: localFlags.length }),
        workItems: workItemsFromGenerated(effectiveGenerated, actions),
        model: effectiveModel,
        generatedKeys: Object.keys(effectiveGenerated),
        securityFlagCount: localFlags.length,
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
    artifactId,
    service,
    sourceText,
    result,
}: {
    artifactId?: string;
    service: PublicDemoService;
    sourceText: string;
    result: Pick<PublicDemoResult, "title" | "summary" | "markdown">;
}): Promise<DemoArtifactSummary> {
    await ensureDemoArtifactTable();
    const id = artifactId ?? randomUUID();
    const resultJson = JSON.stringify(result);

    await prisma.$executeRaw`
        INSERT INTO public_demo_artifacts (id, service, title, summary, source_text, result_json, markdown)
        VALUES (${id}, ${service}, ${result.title}, ${result.summary}, ${sourceText}, CAST(${resultJson} AS jsonb), ${result.markdown})
        ON CONFLICT (id) DO UPDATE SET
            service = EXCLUDED.service,
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            source_text = EXCLUDED.source_text,
            result_json = EXCLUDED.result_json,
            markdown = EXCLUDED.markdown,
            created_at = NOW()
    `;
    await prisma.$executeRaw`
        DELETE FROM public_demo_artifacts
        WHERE service = ${service} AND id NOT IN (
            SELECT id FROM public_demo_artifacts
            WHERE service = ${service}
            ORDER BY created_at DESC
            LIMIT 100
        )
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
            SELECT id, service, title, summary, markdown, source_text AS "sourceText", created_at AS "createdAt"
            FROM public_demo_artifacts
            WHERE service = ${service} AND title <> ${blockedTitle}
            ORDER BY created_at DESC
            LIMIT ${boundedLimit}
        `
        : await prisma.$queryRaw<DemoArtifactRow[]>`
            SELECT id, service, title, summary, markdown, source_text AS "sourceText", created_at AS "createdAt"
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
            ...(service === "opsRadar" && row.service === "opsRadar" ? { sourceText: row.sourceText } : {}),
            createdAt,
        };
    });
}
