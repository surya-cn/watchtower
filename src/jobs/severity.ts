import { prisma } from "@/lib/prisma";
import { ProjectConfigSchema } from "@/lib/schemas";
import { updateClusterPriority } from "./priority";

/**
 * Counts the number of raw posts for a cluster in the last `days` days.
 */
export async function countRecentPosts(clusterId: string, projectId: string, days: number = 7) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  return prisma.rawPost.count({
    where: {
      cluster_id: clusterId,
      project_id: projectId,
      posted_at: {
        gte: daysAgo,
      },
    },
  });
}

/**
 * Deterministically recalculates a cluster's severity based on the number of posts
 * it has received in the last 7 days.
 */
export async function updateClusterSeverity(clusterId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found.`);
  }

  const parseResult = ProjectConfigSchema.safeParse(project.config);
  if (!parseResult.success) {
    throw new Error(`Project ${projectId} has invalid config.`);
  }

  const thresholds = parseResult.data.classification.severity_thresholds;

  const recentPostsCount = await countRecentPosts(clusterId, projectId, 7);

  let newSeverity: "low" | "medium" | "high" = "low";
  if (recentPostsCount >= thresholds.high) {
    newSeverity = "high";
  } else if (recentPostsCount >= thresholds.medium) {
    newSeverity = "medium";
  }

  await prisma.issueCluster.updateMany({
    where: { id: clusterId, project_id: projectId },
    data: { severity: newSeverity },
  });

  await updateClusterPriority(clusterId, projectId);

  return newSeverity;
}
