import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/utils/auth';
import { requireProjectView } from '@/lib/utils/permissions';
import { prisma } from '@/lib/db/prisma';

// GET /api/projects/[projectId]/now
// Convenience redirect to a project's board. Requires auth + view access so it
// cannot be used as an unauthenticated project-existence / org-id oracle.
export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;

    let userId: string;
    try {
        const user = await requireAuth();
        userId = user.id;
    } catch {
        redirect(`/login?callbackUrl=${encodeURIComponent(`/api/projects/${projectId}/now`)}`);
    }

    // Authenticated but unauthorized / non-existent projects all fall back to the
    // dashboard, so membership is never disclosed.
    let target = '/';
    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { orgId: true },
        });
        if (project) {
            await requireProjectView(projectId, userId);
            target = `/org/${project.orgId}/projects/${projectId}/graph`;
        }
    } catch {
        target = '/';
    }

    redirect(target);
}
