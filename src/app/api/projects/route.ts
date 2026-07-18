import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateProjectSchema } from "@/lib/schemas";
import { validationError, conflict, serverError } from "@/lib/errors";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// GET /api/projects — list all projects
// TODO: Scope by user access in Phase 7 (auth)
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        display_name: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return serverError();
  }
}

// POST /api/projects — create a new project
// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        id: parsed.id,
        display_name: parsed.display_name,
        config: parsed.config as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("A project with this ID already exists");
    }
    console.error("POST /api/projects error:", error);
    return serverError();
  }
}

