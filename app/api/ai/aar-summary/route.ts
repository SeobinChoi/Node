import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/ai/openai";
import { generateMilitaryAIJson } from "@/lib/ai/military-documents";
import { z } from "zod";

const AarSummarySchema = z.object({
    projectId: z.string(),
    trainingName: z.string().min(1).max(200),
    sourceText: z.string().min(1).max(15000),
    unitLabel: z.string().max(160).optional(),
    focusAreas: z.array(z.string().max(120)).max(12).default([]),
    includeRiskReview: z.boolean().default(true),
});

const RESPONSE_SHAPE = `{
  "title": "AAR 제목",
  "summary": "훈련 결과 요약",
  "sustain": ["유지할 점"],
  "improve": ["개선할 점"],
  "actionItems": [{"task": "후속 조치", "owner": "담당", "dueDate": "기한 또는 [미정]"}],
  "riskReview": [{"risk": "위험", "mitigation": "완화 조치"}],
  "sections": [{"heading": "분석 항목", "body": "내용"}],
  "reviewChecklist": ["사실/보안/개선계획 확인 항목"]
}`;

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, trainingName, sourceText, unitLabel, focusAreas, includeRiskReview } = AarSummarySchema.parse(body);

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

        const result = await generateMilitaryAIJson({
            projectName: project.name,
            sourceText,
            userInstruction: "Create a training after-action review summary from notes and observations.",
            systemPrompt:
                "You prepare Korean military AAR summaries. Separate sustain/improve points, never invent performance facts, and include practical follow-up actions.",
            responseShape: RESPONSE_SHAPE,
            metadata: { trainingName, unitLabel, focusAreas, includeRiskReview },
        });

        await prisma.activityLog.create({
            data: {
                projectId,
                orgId: project.orgId,
                userId: user.id,
                action: "GENERATE_AAR_SUMMARY",
                entityType: "PROJECT",
                entityId: projectId,
                details: { trainingName, includeRiskReview, securityFlagCount: result.securityFlags.length },
            },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("AAR Summary Generation Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate AAR summary" }, { status: 500 });
    }
}
