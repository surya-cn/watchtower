import { NextResponse } from "next/server";
import { runIngest } from "@/jobs/ingest";
import { runClustering } from "@/jobs/cluster";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    console.log(`[Sync API] Starting manual sync for project: ${projectId}`);
    
    const ingestSummary = await runIngest(projectId);
    const clusterSummary = await runClustering(projectId);
    
    console.log(`[Sync API] Manual sync complete for project: ${projectId}`);

    return NextResponse.json({
      success: true,
      ingest: ingestSummary,
      cluster: clusterSummary
    });
  } catch (error: any) {
    console.error(`[Sync API] Error syncing project:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
