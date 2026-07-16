export type ToolId = "adminDocument" | "meetingSummary" | "aarSummary" | "weeklyReport" | "securityScan";

export type MilitaryAIRequestBody =
    | {
          projectId: string;
          sourceText: string;
          documentType: string;
          audience?: string;
          tone: string;
          constraints: string[];
      }
    | {
          projectId: string;
          sourceText: string;
          meetingTitle: string;
          attendees: string[];
          summaryStyle: string;
      }
    | {
          projectId: string;
          sourceText: string;
          trainingName: string;
          unitLabel?: string;
          focusAreas: string[];
          includeRiskReview: boolean;
      }
    | {
          projectId: string;
          sourceText: string;
          weekOf: string;
          unitLabel?: string;
          commanderFocus: string[];
      }
    | {
          projectId: string;
          text: string;
          contextType: string;
          reviewMode: string;
      };

export const DEFAULT_FIELD_VALUES: Record<string, string> = {
    documentType: "official_memo",
    audience: "",
    tone: "formal",
    constraints: "",
    meetingTitle: "군-학 연계 AI 실무 회의",
    attendees: "",
    summaryStyle: "minutes",
    trainingName: "AI 실무 적용 훈련",
    unitLabel: "",
    focusAreas: "",
    includeRiskReview: "true",
    weekOf: "2026년 전반기",
    commanderFocus: "",
    contextType: "admin_document",
    reviewMode: "submission",
};

export function splitList(value: string) {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function optionalText(value: string) {
    const trimmed = value.trim();
    return trimmed || undefined;
}

export function buildMilitaryAIRequestBody(
    toolId: ToolId,
    projectId: string,
    sourceText: string,
    fields: Record<string, string>
): MilitaryAIRequestBody {
    const field = (key: string) => fields[key] ?? DEFAULT_FIELD_VALUES[key] ?? "";

    if (toolId === "adminDocument") {
        return {
            projectId,
            sourceText,
            documentType: field("documentType"),
            audience: optionalText(field("audience")),
            tone: field("tone"),
            constraints: splitList(field("constraints")),
        };
    }

    if (toolId === "meetingSummary") {
        return {
            projectId,
            sourceText,
            meetingTitle: field("meetingTitle"),
            attendees: splitList(field("attendees")),
            summaryStyle: field("summaryStyle"),
        };
    }

    if (toolId === "aarSummary") {
        return {
            projectId,
            sourceText,
            trainingName: field("trainingName"),
            unitLabel: optionalText(field("unitLabel")),
            focusAreas: splitList(field("focusAreas")),
            includeRiskReview: field("includeRiskReview") === "true",
        };
    }

    if (toolId === "weeklyReport") {
        return {
            projectId,
            sourceText,
            weekOf: field("weekOf"),
            unitLabel: optionalText(field("unitLabel")),
            commanderFocus: splitList(field("commanderFocus")),
        };
    }

    return {
        projectId,
        text: sourceText,
        contextType: field("contextType"),
        reviewMode: field("reviewMode"),
    };
}
