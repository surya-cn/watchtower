import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectIdOrError, notFound, serverError } from "@/lib/errors";

// GET /api/metrics/summary — project-level dashboard metrics
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function GET(req: NextRequest) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return notFound("Project not found");
    }

    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Run all queries in parallel for performance
    const [
      openIssues,
      postsLast7Days,
      newToday,
      escalatedCount,
      categoryBreakdown,
    ] = await Promise.all([
      // open_issues_count: issues with actionable statuses
      prisma.issueCluster.count({
        where: {
          project_id: projectId,
          status: { in: ["new", "active", "escalated"] },
        },
      }),
      // posts_last_7_days: raw posts ingested in the last week
      prisma.rawPost.count({
        where: {
          project_id: projectId,
          posted_at: { gte: sevenDaysAgo },
        },
      }),
      // new_today: issue clusters created today
      prisma.issueCluster.count({
        where: {
          project_id: projectId,
          first_reported_at: { gte: todayStart },
        },
      }),
      // escalated_count: issues specifically in escalated status
      prisma.issueCluster.count({
        where: {
          project_id: projectId,
          status: "escalated",
        },
      }),
      // category_breakdown: count of issues per category
      prisma.issueCluster.groupBy({
        by: ["category"],
        where: { project_id: projectId },
        _count: { category: true },
      }),
    ]);

    return NextResponse.json({
      open_issues_count: openIssues,
      posts_last_7_days: postsLast7Days,
      new_today: newToday,
      escalated_count: escalatedCount,
      category_breakdown: categoryBreakdown.map((row) => ({
        category: row.category,
        count: row._count.category,
      })),
    });
  } catch (error) {
    console.error("GET /api/metrics/summary error:", error);
    return serverError();
  }
}

