import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectIdOrError, serverError } from "@/lib/errors";

// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function GET(req: NextRequest) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get("range") || "30d";
    let days = 30;
    if (rangeParam === "7d") days = 7;
    else if (rangeParam === "90d") days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch raw posts with project_id and cluster_id: not null filters
    const posts = await prisma.rawPost.findMany({
      where: {
        project_id: projectId,
        posted_at: { gte: startDate },
        cluster_id: { not: null },
      },
      select: {
        posted_at: true,
        cluster: {
          select: { category: true },
        },
      },
    });

    // Grouping by date string and category
    const grouped: Record<string, Record<string, number>> = {};

    for (const post of posts) {
      if (!post.cluster) continue;
      
      const dateStr = post.posted_at.toISOString().split("T")[0];
      const category = post.cluster.category;

      if (!grouped[dateStr]) grouped[dateStr] = {};
      if (!grouped[dateStr][category]) grouped[dateStr][category] = 0;
      grouped[dateStr][category]++;
    }

    // Format series
    const series: { date: string; category: string; count: number }[] = [];
    for (const [date, categories] of Object.entries(grouped)) {
      for (const [category, count] of Object.entries(categories)) {
        series.push({ date, category, count });
      }
    }

    // Sort by date ascending
    series.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ range: rangeParam, series });
  } catch (error) {
    console.error("GET /api/metrics/trend error:", error);
    return serverError();
  }
}

