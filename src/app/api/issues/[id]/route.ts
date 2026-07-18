import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectIdOrError, notFound, serverError } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/issues/:id — full detail with linked posts and status history
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    const { id } = await params;

    // Use findFirst with compound where (not findUnique with id alone)
    // to enforce multi-tenancy at the query level
    const cluster = await prisma.issueCluster.findFirst({
      where: { id, project_id: projectId },
      include: {
        raw_posts: {
          select: {
            id: true,
            source: true,
            author: true,
            content: true,
            url: true,
            posted_at: true,
          },
        },
        status_history: {
          orderBy: { changed_at: "desc" },
        },
      },
    });

    if (!cluster) {
      return notFound("Issue not found");
    }

    return NextResponse.json(cluster);
  } catch (error) {
    console.error("GET /api/issues/:id error:", error);
    return serverError();
  }
}
