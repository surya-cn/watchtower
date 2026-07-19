import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateStatusSchema } from "@/lib/schemas";
import { updateClusterPriority } from "@/jobs/priority";
import {
  getProjectIdOrError,
  notFound,
  validationError,
  serverError,
} from "@/lib/errors";
import { ZodError } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/issues/:id/status — update status + insert history row
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateStatusSchema.parse(body);

    // 1. Verify issue exists AND belongs to this project
    const existing = await prisma.issueCluster.findFirst({
      where: { id, project_id: projectId },
    });

    if (!existing) {
      console.error(`DEBUG: Issue not found in PATCH. id=${id}, projectId=${projectId}`);
      return notFound("Issue not found");
    }

    // 2. Atomic: status change + history entry succeed or fail together.
    //    Uses updateMany (not update) because update() requires a unique
    //    where clause, and { id, project_id } is not declared as @@unique.
    //    updateMany accepts arbitrary where clauses.
    await prisma.$transaction([
      prisma.issueCluster.updateMany({
        where: { id, project_id: projectId },
        data: { status: parsed.status },
      }),
      prisma.statusHistory.create({
        data: {
          project_id: projectId,
          cluster_id: id,
          status: parsed.status,
          note: parsed.note ?? null,
        },
      }),
    ]);

    // 3. Update priority score (wait for it so it is included in the refetch below if possible, wait actually we re-fetch below, so it'll get the updated priority score)
    await updateClusterPriority(id, projectId);

    // 4. Re-fetch the updated record (updateMany returns { count }, not the row)
    const updated = await prisma.issueCluster.findFirst({
      where: { id, project_id: projectId },
      include: {
        status_history: { orderBy: { changed_at: "desc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }
    console.error("PATCH /api/issues/:id/status error:", error);
    return serverError();
  }
}
