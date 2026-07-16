export type SecuritySeverity = "low" | "medium" | "high";

export interface SecurityFlag {
    id: string;
    label: string;
    severity: SecuritySeverity;
    matchCount: number;
    guidance: string;
}

interface SensitivePattern {
    id: string;
    label: string;
    severity: SecuritySeverity;
    pattern: RegExp;
    guidance: string;
}

export interface MilitaryAIRequest {
    projectName: string;
    sourceText: string;
    systemPrompt: string;
    responseShape: string;
    userInstruction?: string;
    metadata?: Record<string, unknown>;
    temperature?: number;
    maxTokens?: number;
}

export interface MilitaryAIResult {
    generated: Record<string, unknown>;
    securityFlags: SecurityFlag[];
    model: string;
}

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type MilitaryAIProvider = "gemini" | "openai";

const SENSITIVE_PATTERNS: SensitivePattern[] = [
    {
        id: "phone_number",
        label: "Phone number pattern",
        severity: "medium",
        pattern: /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g,
        guidance: "Mask personal phone numbers before using the output in a submission artifact.",
    },
    {
        id: "email_address",
        label: "Email address pattern",
        severity: "medium",
        pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        guidance: "Replace personal email addresses with role-based labels unless disclosure is approved.",
    },
    {
        id: "resident_registration_number",
        label: "Resident registration number-like pattern",
        severity: "high",
        pattern: /\b\d{6}[-\s]?[1-4]\d{6}\b/g,
        guidance: "Remove resident-registration-number-like values from all generated drafts.",
    },
    {
        id: "precise_location",
        label: "Precise location or coordinate indicator",
        severity: "high",
        pattern: /\b(?:MGRS|UTM|GPS)\b|좌표|위경도|\b\d{1,3}\.\d{4,}\s*,\s*\d{1,3}\.\d{4,}\b/gi,
        guidance: "Generalize exact coordinates, guard-post locations, and sensitive facility references.",
    },
    {
        id: "classified_or_operational_term",
        label: "Classified or operational term",
        severity: "high",
        pattern: /대외비|군사비밀|작전명|암구호|탄약고|초소|경계근무|상황실|CCTV/gi,
        guidance: "Confirm releasability with the security reviewer before copying this content.",
    },
];

export function scanMilitarySensitiveContent(texts: string[]): SecurityFlag[] {
    const combinedText = texts.filter(Boolean).join("\n\n");

    return SENSITIVE_PATTERNS.flatMap((sensitivePattern) => {
        const matches = combinedText.match(sensitivePattern.pattern);
        if (!matches || matches.length === 0) {
            return [];
        }

        return [
            {
                id: sensitivePattern.id,
                label: sensitivePattern.label,
                severity: sensitivePattern.severity,
                matchCount: matches.length,
                guidance: sensitivePattern.guidance,
            },
        ];
    });
}

export function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
}

function stripJsonFence(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

function findBalancedJsonObject(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
        const character = text[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (character === "\\") {
            escaped = true;
            continue;
        }

        if (character === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (character === "{") {
            depth += 1;
        } else if (character === "}") {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, index + 1);
            }
        }
    }

    return null;
}

export function parseJsonObject(text: string): Record<string, unknown> {
    const cleaned = stripJsonFence(text);

    try {
        return asRecord(JSON.parse(cleaned));
    } catch {
        const jsonObjectText = findBalancedJsonObject(cleaned);
        if (jsonObjectText) {
            try {
                return asRecord(JSON.parse(jsonObjectText));
            } catch {
                // Fall through to the stable user-facing fallback below.
            }
        }

        return {
            title: "AI response parsing failed",
            summary: "The model returned non-JSON output. Please retry with shorter source text.",
            sections: [],
            reviewChecklist: ["Retry generation", "Confirm sensitive information is removed"],
        };
    }
}

function buildMilitaryPrompt(request: MilitaryAIRequest): string {
    return [
        `Project: ${request.projectName}`,
        request.metadata ? `Metadata: ${JSON.stringify(request.metadata)}` : "",
        request.userInstruction ? `User instruction: ${request.userInstruction}` : "",
        `Source text:\n${request.sourceText}`,
        `Required JSON shape:\n${request.responseShape}`,
        "Rules:",
        "- Write in Korean unless the source text clearly asks for another language.",
        "- Do not invent real names, phone numbers, unit designations, precise locations, or classified facts.",
        "- Use placeholders such as [담당자], [부대명], [일자], and [장소] when source evidence is missing.",
        "- Keep the output ready for a human reviewer, not directly auto-approved.",
        "- Include a reviewChecklist array with security and factual-confirmation checks.",
        "- Return only one valid JSON object. Do not wrap it in Markdown.",
    ]
        .filter(Boolean)
        .join("\n\n");
}

function getGeminiApiKey(): string | null {
    return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        null
    );
}

function getMilitaryAIProvider(): MilitaryAIProvider {
    const preferredProvider = process.env.MILITARY_AI_PROVIDER?.toLowerCase();

    if (preferredProvider === "gemini" || preferredProvider === "google") {
        return "gemini";
    }

    if (preferredProvider === "openai") {
        return "openai";
    }

    return getGeminiApiKey() ? "gemini" : "openai";
}

async function generateWithGemini(request: MilitaryAIRequest, prompt: string): Promise<MilitaryAIResult["generated"]> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const baseUrl = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
    const endpoint = `${baseUrl}/models/${model}:generateContent`;
    const controller = new AbortController();
    const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 60_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: request.systemPrompt }],
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: request.temperature ?? 0.35,
                    maxOutputTokens: request.maxTokens ?? 2500,
                },
            }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }

    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`Gemini API request failed (${response.status}): ${responseText.slice(0, 500)}`);
    }

    const body = asRecord(JSON.parse(responseText));
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const firstCandidate = asRecord(candidates[0]);
    const content = asRecord(firstCandidate.content);
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const generatedText = parts
        .map((part) => {
            const record = asRecord(part);
            return typeof record.text === "string" ? record.text : "";
        })
        .join("")
        .trim();

    return parseJsonObject(generatedText || "{}");
}

async function generateWithOpenAI(request: MilitaryAIRequest, prompt: string): Promise<MilitaryAIResult["generated"]> {
    const { getOpenAIClient } = await import("@/lib/ai/openai");
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: request.temperature ?? 0.35,
        max_tokens: request.maxTokens ?? 2500,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";

    return parseJsonObject(responseText);
}

export async function generateMilitaryAIJson(request: MilitaryAIRequest): Promise<MilitaryAIResult> {
    const securityFlags = scanMilitarySensitiveContent([
        request.projectName,
        request.sourceText,
        request.userInstruction ?? "",
        JSON.stringify(request.metadata ?? {}),
    ]);

    const prompt = buildMilitaryPrompt(request);
    const provider = getMilitaryAIProvider();
    const model = provider === "gemini"
        ? process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
        : DEFAULT_OPENAI_MODEL;
    const generated = provider === "gemini"
        ? await generateWithGemini(request, prompt)
        : await generateWithOpenAI(request, prompt);

    return {
        generated,
        securityFlags,
        model,
    };
}
