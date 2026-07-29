import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    generatePublicDemoResult,
    normalizeDemoService,
} from "@/lib/ai/public-demo-service";
import { isPublicAiDemoEnabled, publicDemoDisabledResponse } from "@/lib/ai/demo-gate";

const GenerateSchema = z.object({
    service: z.string().min(1).max(40),
    tool: z.string().max(60).optional().default(""),
    mode: z.string().max(60).optional().default(""),
    // Cost scales with input length. 4k chars is ample for a demo paste and
    // caps the per-request spend at a third of the previous 12k ceiling.
    sourceText: z.string().min(1).max(4000),
});

// NOTE: this is a best-effort speed bump only — it is per-instance memory and
// keyed on a spoofable header. The real cost control is the kill switch in
// lib/ai/demo-gate.ts.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function getRequestKey(req: NextRequest) {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-demo";
}

function checkRateLimit(key: string) {
    const now = Date.now();
    const current = rateLimitMap.get(key);
    if (!current || now > current.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (current.count >= RATE_LIMIT_MAX) return false;
    current.count += 1;
    return true;
}

export async function POST(req: NextRequest) {
    try {
        if (!isPublicAiDemoEnabled()) {
            return publicDemoDisabledResponse();
        }

        if (!checkRateLimit(getRequestKey(req))) {
            return NextResponse.json({ error: "Too many demo requests. Please wait a minute." }, { status: 429 });
        }

        const body = GenerateSchema.parse(await req.json());
        const result = await generatePublicDemoResult({
            service: normalizeDemoService(body.service),
            tool: body.tool,
            mode: body.mode,
            sourceText: body.sourceText,
        });

        return NextResponse.json({ ok: true, result });
    } catch (error) {
        console.error("Public Demo Generate Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid demo input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate demo result" }, { status: 500 });
    }
}
