import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    normalizeDemoService,
    saveDemoArtifact,
    type PublicDemoResult,
} from "@/lib/ai/public-demo-service";
import { isPublicAiDemoEnabled, publicDemoDisabledResponse } from "@/lib/ai/demo-gate";

const SaveSchema = z.object({
    service: z.string().min(1).max(40),
    sourceText: z.string().min(1).max(4000),
    result: z.object({}).passthrough(),
});

/**
 * GET no longer returns saved artifacts.
 *
 * Demo visitors are anonymous, so there is no identity to scope a listing to —
 * the previous implementation returned the most recent artifacts from ALL
 * visitors. Anyone pasting a real internal document into the public demo had the
 * generated write-up of it served to every other visitor. Since we cannot tell
 * "mine" from "someone else's" here, we serve nothing rather than leak.
 */
export async function GET() {
    return NextResponse.json({ ok: true, artifacts: [] });
}

export async function POST(req: NextRequest) {
    try {
        if (!isPublicAiDemoEnabled()) {
            return publicDemoDisabledResponse();
        }

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
