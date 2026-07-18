import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectConfigSchema } from "@/lib/schemas";
import { notFound, validationError, serverError } from "@/lib/errors";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/:id/config
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { config: true },
    });

    if (!project) {
      return notFound("Project not found");
    }

    return NextResponse.json(project.config);
  } catch (error) {
    console.error("GET /api/projects/:id/config error:", error);
    return serverError();
  }
}

// PUT /api/projects/:id/config
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function PUT(
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

    const body = await req.json();
    const config = ProjectConfigSchema.parse(body);

    const updated = await prisma.project.update({
      where: { id },
      data: { config: config as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json(updated.config);
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }
    console.error("PUT /api/projects/:id/config error:", error);
    return serverError();
  }
}
