import { NextResponse } from "next/server";
import { runIngest } from "@/jobs/ingest";
import { runClustering } from "@/jobs/cluster";

export const maxDuration = 300; // 5 minutes, requires Fluid Compute on Hobby plan

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    
    // Require CRON_SECRET to be configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[Sync API] CRON_SECRET is not set in environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify Bearer token
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Sync API] Unauthorized access attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Sync API] Starting scheduled sync job...");

    // 1. Run Ingestion for all projects
    const ingestSummary = await runIngest();

    // 2. Run Clustering for all projects
    const clusterSummary = await runClustering();

    console.log("[Sync API] Sync job complete.");

    // Return the combined summary
    return NextResponse.json({
      success: true,
      ingest: ingestSummary,
      cluster: clusterSummary,
    });
  } catch (error: any) {
    console.error("[Sync API] Fatal error during sync job:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
