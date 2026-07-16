import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/ai/openai";
import { generateMilitaryAIJson } from "@/lib/ai/military-documents";
import { z } from "zod";

const AdminDocumentSchema = z.object({
    projectId: z.string(),
    documentType: z
        .enum(["official_memo", "request", "training_plan", "operation_support", "after_action_note", "other"])
        .default("official_memo"),
    sourceText: z.string().min(1).max(12000),
    audience: z.string().max(200).optional(),
    tone: z.enum(["formal", "concise", "commander_brief"]).default("formal"),
    constraints: z.array(z.string().max(300)).max(12).default([]),
});

const RESPONSE_SHAPE = `{
  "title": "문서 제목",
  "documentType": "official_memo | request | training_plan | operation_support | after_action_note | other",
  "summary": "3문장 이내 요약",
  "draft": "공문/보고서 본문 초안",
  "sections": [{"heading": "항목명", "body": "항목별 본문"}],
  "missingInputs": ["추가 확인이 필요한 값"],
  "assumptions": ["초안 작성 시 둔 가정"],
  "reviewChecklist": ["보안/사실/결재선 확인 항목"]
}`;

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, documentType, sourceText, audience, tone, constraints } = AdminDocumentSchema.parse(body);

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
            userInstruction: "Create a military administrative document draft that can be reviewed by a human officer.",
            systemPrompt:
                "You draft Korean military administrative documents. Be precise, conservative, and explicit about missing evidence. Never treat the output as final approval.",
            responseShape: RESPONSE_SHAPE,
            metadata: { documentType, audience, tone, constraints },
        });

        await prisma.activityLog.create({
            data: {
                projectId,
                orgId: project.orgId,
                userId: user.id,
                action: "GENERATE_ADMIN_DOCUMENT",
                entityType: "PROJECT",
                entityId: projectId,
                details: { documentType, securityFlagCount: result.securityFlags.length },
            },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Admin Document Generation Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate admin document" }, { status: 500 });
    }
}
