import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, serverError } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

// DELETE /api/projects/:id
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Check project exists
    const existing = await prisma.project.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return notFound("Project not found");
    }

    // Explicitly delete child records in the correct order to respect foreign key constraints,
    // since prisma/schema.prisma does not have onDelete: Cascade defined for these.
    // Note: ProjectAccess is not deleted here since we don't use it yet, but if it exists, it needs to be deleted too.
    // We will delete it just in case.
    await prisma.$transaction([
      prisma.statusHistory.deleteMany({ where: { project_id: id } }),
      prisma.rawPost.deleteMany({ where: { project_id: id } }),
      prisma.issueCluster.deleteMany({ where: { project_id: id } }),
      prisma.projectAccess.deleteMany({ where: { project_id: id } }),
      prisma.project.delete({ where: { id } })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/projects/:id error:", error);
    return serverError();
  }
}
