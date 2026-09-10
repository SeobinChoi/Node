import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    generatePublicDemoResult,
    normalizeDemoService,
    PublicDemoSensitiveInputError,
} from "@/lib/ai/public-demo-service";

const GenerateSchema = z.object({
    service: z.string().min(1).max(40),
    tool: z.string().max(60).optional().default(""),
    mode: z.string().max(60).optional().default(""),
    sourceText: z.string().min(1).max(12000),
    exampleId: z.string().max(80).optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 40;
const MAX_BODY_BYTES = 80000;

class PayloadTooLargeError extends Error {}

function getRequestKey(req: NextRequest) {
    // ponytail: non-Vercel deployments share one limiter; add a trusted proxy adapter if needed.
    return req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "untrusted-demo";
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

async function readBoundedJson(req: NextRequest) {
    if (!req.body) throw new SyntaxError("Missing request body");
    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_BODY_BYTES) {
                await reader.cancel();
                throw new PayloadTooLargeError();
            }
            text += decoder.decode(value, { stream: true });
        }
        return JSON.parse(text + decoder.decode());
    } finally {
        reader.releaseLock();
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!checkRateLimit(getRequestKey(req))) {
            return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
        }
        if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
            return NextResponse.json({ error: "입력 내용이 너무 큽니다." }, { status: 413 });
        }

        const body = GenerateSchema.parse(await readBoundedJson(req));
        const result = await generatePublicDemoResult({
            service: normalizeDemoService(body.service),
            tool: body.tool,
            mode: body.mode,
            sourceText: body.sourceText,
            exampleId: body.exampleId,
        });

        return NextResponse.json({ ok: true, result });
    } catch (error) {
        if (error instanceof PublicDemoSensitiveInputError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof PayloadTooLargeError) {
            return NextResponse.json({ error: "입력 내용이 너무 큽니다." }, { status: 413 });
        }

        if (error instanceof z.ZodError || error instanceof SyntaxError) {
            return NextResponse.json({ error: "입력 내용을 확인해 주세요." }, { status: 400 });
        }

        console.error("Public Demo Generate Error:", error);
        return NextResponse.json({ error: "AI 생성에 실패했습니다." }, { status: 500 });
    }
}
