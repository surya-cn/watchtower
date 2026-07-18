import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const response = NextResponse.json({});
    const session = await getIronSession<SessionData>(
      req,
      response,
      sessionOptions
    );

    if (session.user) {
      return NextResponse.json({ user: session.user });
    }

    return NextResponse.json({ user: null });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
