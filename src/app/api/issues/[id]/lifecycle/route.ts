import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectIdOrError, notFound, serverError } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    const { id } = await params;

    // Verify issue exists
    const cluster = await prisma.issueCluster.findFirst({
      where: { id, project_id: projectId },
    });

    if (!cluster) {
      return notFound("Issue not found");
    }

    // Fetch raw posts
    const posts = await prisma.rawPost.findMany({
      where: {
        cluster_id: id,
        project_id: projectId,
      },
      select: {
        posted_at: true,
      },
    });

    // Group by date string
    const grouped: Record<string, number> = {};
    for (const post of posts) {
      const dateStr = post.posted_at.toISOString().split("T")[0];
      grouped[dateStr] = (grouped[dateStr] || 0) + 1;
    }

    const post_counts_by_date = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Fetch status events
    const statusEvents = await prisma.statusHistory.findMany({
      where: {
        cluster_id: id,
        project_id: projectId,
      },
      orderBy: { changed_at: "asc" },
      select: {
        status: true,
        changed_at: true,
        note: true,
      },
    });

    return NextResponse.json({
      post_counts_by_date,
      status_events: statusEvents,
    });
  } catch (error) {
    console.error("GET /api/issues/:id/lifecycle error:", error);
    return serverError();
  }
}
