import { prisma } from "@/lib/prisma";
import { countRecentPosts } from "./severity";

/**
 * Calculates and updates a cluster's priority score deterministically.
 * Formula: (severity_weight * 10) + (recent_post_count * 2) + (recurrence_ratio * 50)
 * Where:
 * - severity_weight: high=3, medium=2, low=1
 * - recurrence_ratio: reports_after_closure / reports_before_closure (in equal time windows)
 */
export async function updateClusterPriority(clusterId: string, projectId: string) {
  const cluster = await prisma.issueCluster.findFirst({
    where: { id: clusterId, project_id: projectId },
  });

  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found in project ${projectId}.`);
  }

  // 1. Severity weight
  let severityWeight = 1;
  if (cluster.severity === "high") severityWeight = 3;
  else if (cluster.severity === "medium") severityWeight = 2;

  // 2. Recent post count (last 7 days)
  const recentPostCount = await countRecentPosts(clusterId, projectId, 7);

  // 3. Recurrence ratio
  let recurrenceRatio = 0;
  
  if (
    cluster.status === "fixed" ||
    cluster.status === "resolved" ||
    cluster.status === "closed_false_positive"
  ) {
    // Find the most recent closure event
    const closureEvent = await prisma.statusHistory.findFirst({
      where: {
        cluster_id: clusterId,
        project_id: projectId,
        status: { in: ["fixed", "resolved", "closed_false_positive"] },
      },
      orderBy: { changed_at: "desc" },
    });

    if (closureEvent) {
      const closureDate = closureEvent.changed_at;
      const timePassedMs = Date.now() - closureDate.getTime();
      
      // If the event just happened, ratio is 0
      if (timePassedMs > 0) {
        const windowStart = new Date(closureDate.getTime() - timePassedMs);

        // Posts after closure
        const reportsAfter = await prisma.rawPost.count({
          where: {
            cluster_id: clusterId,
            project_id: projectId,
            posted_at: { gte: closureDate },
          },
        });

        // Posts before closure (in equal time window)
        const reportsBefore = await prisma.rawPost.count({
          where: {
            cluster_id: clusterId,
            project_id: projectId,
            posted_at: {
              gte: windowStart,
              lt: closureDate,
            },
          },
        });

        recurrenceRatio = reportsAfter / Math.max(1, reportsBefore);
      }
    }
  }

  // Priority Score
  const priorityScore = (severityWeight * 10) + (recentPostCount * 2) + (recurrenceRatio * 50);

  await prisma.issueCluster.updateMany({
    where: { id: clusterId, project_id: projectId },
    data: { 
      priority_score: priorityScore,
      recurrence_ratio: recurrenceRatio
    },
  });

  return { priorityScore, recurrenceRatio };
}
