import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    listDemoArtifacts,
    normalizeDemoService,
    saveDemoArtifact,
    type PublicDemoResult,
} from "@/lib/ai/public-demo-service";

const SaveSchema = z.object({
    service: z.string().min(1).max(40),
    sourceText: z.string().min(1).max(12000),
    result: z.object({}).passthrough(),
});

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
        const body = SaveSchema.parse(await req.json());
        const artifact = await saveDemoArtifact({
            service: normalizeDemoService(body.service),
            sourceText: body.sourceText,
            result: body.result as unknown as PublicDemoResult,
        });

        return NextResponse.json({ ok: true, artifact });
    } catch (error) {
        console.error("Public Demo Artifact Save Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid save payload" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to save demo artifact" }, { status: 500 });
    }
}
