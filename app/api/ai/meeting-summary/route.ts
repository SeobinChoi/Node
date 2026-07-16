import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/ai/openai";
import { generateMilitaryAIJson } from "@/lib/ai/military-documents";
import { z } from "zod";

const MeetingSummarySchema = z.object({
    projectId: z.string(),
    meetingTitle: z.string().min(1).max(200),
    sourceText: z.string().min(1).max(15000),
    attendees: z.array(z.string().max(80)).max(50).default([]),
    summaryStyle: z.enum(["minutes", "commander_brief", "action_tracker"]).default("minutes"),
});

const RESPONSE_SHAPE = `{
  "title": "회의록 제목",
  "summary": "핵심 요약",
  "decisions": [{"decision": "결정 사항", "owner": "담당", "dueDate": "기한 또는 [미정]"}],
  "actionItems": [{"task": "조치", "owner": "담당", "dueDate": "기한 또는 [미정]", "risk": "위험"}],
  "openQuestions": ["추가 확인사항"],
  "sections": [{"heading": "회의 항목", "body": "정리 내용"}],
  "reviewChecklist": ["보안/참석자/결정사항 확인 항목"]
}`;

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, meetingTitle, sourceText, attendees, summaryStyle } = MeetingSummarySchema.parse(body);

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
            userInstruction: "Summarize meeting notes into decisions, action items, open questions, and review checks.",
            systemPrompt:
                "You prepare Korean military meeting minutes. Preserve decisions and action ownership, mark unknown facts as [미정], and flag review needs.",
            responseShape: RESPONSE_SHAPE,
            metadata: { meetingTitle, attendees, summaryStyle },
        });

        await prisma.activityLog.create({
            data: {
                projectId,
                orgId: project.orgId,
                userId: user.id,
                action: "GENERATE_MEETING_SUMMARY",
                entityType: "PROJECT",
                entityId: projectId,
                details: { meetingTitle, summaryStyle, action: "summary", securityFlagCount: result.securityFlags.length },
            },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Meeting Summary Generation Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate meeting summary" }, { status: 500 });
    }
}
