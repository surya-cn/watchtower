import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IssuesQuerySchema } from "@/lib/schemas";
import {
  getProjectIdOrError,
  notFound,
  validationError,
  serverError,
} from "@/lib/errors";
import { ZodError } from "zod";
import { Prisma, Severity, Status } from "@prisma/client";

function getSortOrder(
  sortBy: string
): Prisma.IssueClusterOrderByWithRelationInput {
  switch (sortBy) {
    case "severity_desc":
      return { severity: "desc" };
    case "post_count_desc":
      return { post_count: "desc" };
    case "priority_score_desc":
      return { priority_score: "desc" };
    case "last_reported_desc":
    default:
      return { last_reported_at: "desc" };
  }
}

// GET /api/issues — paginated, filtered issue list
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

    // Parse query params
    const searchParams = Object.fromEntries(
      req.nextUrl.searchParams.entries()
    );
    const query = IssuesQuerySchema.parse(searchParams);

    // Build where clause
    const where: Prisma.IssueClusterWhereInput = {
      project_id: projectId,
    };

    if (query.status) {
      const statuses = query.status
        .split(",")
        .map((s) => s.trim()) as Status[];
      where.status = { in: statuses };
    }

    if (query.severity) {
      const severities = query.severity
        .split(",")
        .map((s) => s.trim()) as Severity[];
      where.severity = { in: severities };
    }

    if (query.category) {
      const categories = query.category
        .split(",")
        .map((s) => s.trim());
      where.category = { in: categories };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // Execute count + query in parallel
    const sortBy = query.sort_by || "last_reported_desc";
    const page = query.page;
    const pageSize = query.page_size;
    const skip = (page - 1) * pageSize;

    const [totalCount, issues] = await Promise.all([
      prisma.issueCluster.count({ where }),
      prisma.issueCluster.findMany({
        where,
        select: {
          id: true,
          title: true,
          summary: true,
          category: true,
          severity: true,
          status: true,
          post_count: true,
          priority_score: true,
          recurrence_ratio: true,
          first_reported_at: true,
          last_reported_at: true,
        },
        orderBy: getSortOrder(sortBy),
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      data: issues,
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }
    console.error("GET /api/issues error:", error);
    return serverError();
  }
}

