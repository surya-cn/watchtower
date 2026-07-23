import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectIdOrError, notFound, serverError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    const { id: clusterId } = await params;

    // Confirm cluster exists for this project (tenant scoping)
    const cluster = await prisma.issueCluster.findFirst({
      where: {
        id: clusterId,
        project_id: projectId,
      },
      select: {
        id: true,
      }
    });

    if (!cluster) {
      return notFound("Cluster not found");
    }

    // Fetch all raw posts for this cluster EXCEPT the latest one
    const similarPosts = await prisma.rawPost.findMany({
      where: {
        cluster_id: clusterId,
        project_id: projectId,
      },
      orderBy: [
        { posted_at: "desc" },
        { id: "desc" }
      ],
      skip: 1, // Skip the first one which is returned as latest_post
      select: {
        id: true,
        content: true,
        url: true,
        author: true,
        source: true,
        posted_at: true,
      }
    });

    return NextResponse.json(similarPosts);
  } catch (error) {
    console.error("GET /api/issues/[id]/similar error:", error);
    return serverError();
  }
}
