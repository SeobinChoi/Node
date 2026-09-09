import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    listDemoArtifacts,
    normalizeDemoService,
    saveDemoArtifact,
} from "@/lib/ai/public-demo-service";
import { parseOpsRadarSnapshot } from "@/lib/demo/ops-radar-snapshot";

const SaveSchema = z.object({
    service: z.string().min(1).max(40),
    sourceText: z.string().min(1).max(12000),
    result: z.object({
        title: z.string().min(1).max(100),
        summary: z.string().max(2000),
        markdown: z.string().max(20000),
    }),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 12;

function checkRateLimit(req: NextRequest) {
    const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-demo";
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

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const service = searchParams.get("service");
        const limit = Number(searchParams.get("limit") || 8);
        const artifacts = await listDemoArtifacts(service ? normalizeDemoService(service) : undefined, limit);

        return NextResponse.json({ ok: true, artifacts });
    } catch (error) {
        console.error("Public Demo Artifact List Error:", error);
        return NextResponse.json({ error: "Failed to load saved demo artifacts" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!checkRateLimit(req)) {
            return NextResponse.json({ error: "Too many save requests. Please wait a minute." }, { status: 429 });
        }
        if (Number(req.headers.get("content-length") || 0) > 80000) {
            return NextResponse.json({ error: "Save payload is too large" }, { status: 413 });
        }
        const body = SaveSchema.parse(await req.json());
        const service = normalizeDemoService(body.service);
        const snapshot = service === "opsRadar" ? parseOpsRadarSnapshot(body.sourceText) : undefined;
        const artifact = await saveDemoArtifact({
            artifactId: snapshot ? `ops-radar-${snapshot.scenarioId}` : undefined,
            service,
            sourceText: body.sourceText,
            result: body.result,
        });

        return NextResponse.json({ ok: true, artifact });
    } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid save payload" }, { status: 400 });
        }

        console.error("Public Demo Artifact Save Error:", error);

        return NextResponse.json({ error: "Failed to save demo artifact" }, { status: 500 });
    }
}
