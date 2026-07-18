import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message: string = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(message: string = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function validationError(zodError: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: zodError.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

/**
 * Extracts and validates the X-Project-Id header.
 * Returns the project ID string, or a NextResponse error if missing.
 */
export function getProjectIdOrError(
  headers: Headers
): string | NextResponse {
  const projectId = headers.get("x-project-id");
  if (!projectId) {
    return badRequest("Missing required header: X-Project-Id");
  }
  return projectId;
}
