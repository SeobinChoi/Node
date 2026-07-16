import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/ai/openai";
import { generateMilitaryAIJson } from "@/lib/ai/military-documents";
import { z } from "zod";

const WeeklyMetricSchema = z.object({
    label: z.string().min(1).max(100),
    value: z.string().min(1).max(100),
    note: z.string().max(240).optional(),
});

const WeeklyReportSchema = z.object({
    projectId: z.string(),
    weekOf: z.string().min(1).max(80),
    unitLabel: z.string().max(160).optional(),
    sourceText: z.string().min(1).max(15000),
    metrics: z.array(WeeklyMetricSchema).max(20).default([]),
    commanderFocus: z.array(z.string().max(160)).max(8).default([]),
});

const RESPONSE_SHAPE = `{
  "title": "주간보고 제목",
  "summary": "주간 핵심 요약",
  "completed": ["완료 사항"],
  "inProgress": ["진행 중 사항"],
  "risks": [{"risk": "위험/이슈", "impact": "영향", "mitigation": "대응"}],
  "nextWeek": ["차주 계획"],
  "metricsNarrative": "지표 해석",
  "sections": [{"heading": "보고 항목", "body": "본문"}],
  "reviewChecklist": ["수치/보안/일정 확인 항목"]
}`;

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, weekOf, unitLabel, sourceText, metrics, commanderFocus } = WeeklyReportSchema.parse(body);

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
            userInstruction: "Create a weekly situation report from project and unit notes.",
            systemPrompt:
                "You prepare Korean weekly situation reports. Convert raw updates into concise completed/in-progress/risk/next-week sections and mark unknown values.",
            responseShape: RESPONSE_SHAPE,
            metadata: { weekOf, unitLabel, metrics, commanderFocus },
        });

        await prisma.activityLog.create({
            data: {
                projectId,
                orgId: project.orgId,
                userId: user.id,
                action: "GENERATE_WEEKLY_REPORT",
                entityType: "PROJECT",
                entityId: projectId,
                details: { weekOf, metricCount: metrics.length, securityFlagCount: result.securityFlags.length },
            },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Weekly Report Generation Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate weekly report" }, { status: 500 });
    }
}
