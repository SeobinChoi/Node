import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/ai/openai";
import { generateMilitaryAIJson, scanMilitarySensitiveContent } from "@/lib/ai/military-documents";
import { z } from "zod";

const SecurityScanSchema = z.object({
    projectId: z.string(),
    text: z.string().min(1).max(15000),
    contextType: z.enum(["admin_document", "meeting_minutes", "aar", "weekly_report", "screenshot_note", "other"]).default("other"),
    reviewMode: z.enum(["quick", "submission"]).default("submission"),
});

const RESPONSE_SHAPE = `{
  "title": "보안 검토 요약",
  "summary": "제출 가능성 요약",
  "riskLevel": "low | medium | high",
  "recommendedRedactions": [{"category": "항목", "reason": "사유", "replacement": "권장 대체 표현"}],
  "safeRewrite": "민감정보를 일반화한 제출용 문장",
  "reviewChecklist": ["최종 확인 항목"]
}`;

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, text, contextType, reviewMode } = SecurityScanSchema.parse(body);

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, orgId: true, name: true },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        await requireProjectView(projectId, user.id);

        const isPro = await isOrgPro(project.orgId);
        if (!isPro) {
            return NextResponse.json({ error: "AI features require a Pro subscription" }, { status: 403 });
        }

        if (!checkRateLimit(user.id)) {
            return NextResponse.json({ error: "Rate limit exceeded. Please try again in a minute." }, { status: 429 });
        }

        const localFlags = scanMilitarySensitiveContent([text, contextType, reviewMode]);
        const result = await generateMilitaryAIJson({
            projectName: project.name,
            sourceText: text,
            userInstruction:
                "Review this text for military-academic program submission safety. Recommend redactions and provide a safer rewrite.",
            systemPrompt:
                "You are a Korean military document security reviewer. Be conservative, do not reveal detected sensitive values, and recommend generalized replacements.",
            responseShape: RESPONSE_SHAPE,
            metadata: { contextType, reviewMode, localFlagCount: localFlags.length },
            temperature: 0.2,
        });

        await prisma.activityLog.create({
            data: {
                projectId,
                orgId: project.orgId,
                userId: user.id,
                action: "SECURITY_SCAN_AI_TEXT",
                entityType: "PROJECT",
                entityId: projectId,
                details: { contextType, reviewMode, localFlagCount: localFlags.length },
            },
        });

        return NextResponse.json({
            ...result,
            localFlags,
        });
    } catch (error) {
        console.error("Security Scan Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to scan text" }, { status: 500 });
    }
}
