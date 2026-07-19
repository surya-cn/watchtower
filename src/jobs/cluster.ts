import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ProjectConfigSchema } from "../lib/schemas";
import { classifyAndMatchPost, generateClusterSummary } from "../lib/llm";
import { updateClusterSeverity } from "./severity";

export interface ClusterResult {
  postsProcessed: number;
  newClusters: number;
  matched: number;
  skipped: number;
  stoppedEarly: boolean;
}

const BATCH_SIZE = 20;

export async function runClustering(targetProjectId: string | null = null): Promise<ClusterResult> {
  const startTime = Date.now();
  const MAX_DURATION_MS = 45000;
  let stoppedEarly = false;
  const projects = await prisma.project.findMany({
    where: targetProjectId ? { id: targetProjectId } : undefined,
  });

  if (projects.length === 0) {
    console.log(`No projects found${targetProjectId ? ` matching ID: ${targetProjectId}` : ""}.`);
    return { postsProcessed: 0, newClusters: 0, matched: 0, skipped: 0, stoppedEarly: false };
  }

  let totalPostsProcessed = 0;
  let totalNewClusters = 0;
  let totalMatched = 0;
  let totalSkipped = 0;

  for (const project of projects) {
    if (Date.now() - startTime > MAX_DURATION_MS) {
      console.log(`[Cluster] Stopping early - reached time limit of ${MAX_DURATION_MS}ms. More work remains for next run.`);
      stoppedEarly = true;
      break;
    }

    console.log(`\n======================================`);
    console.log(`Clustering for Project: ${project.id}`);
    console.log(`======================================`);

    const parseResult = ProjectConfigSchema.safeParse(project.config);
    if (!parseResult.success) {
      console.error(`[Project ${project.id}] Invalid config structure, skipping.`);
      continue;
    }
    const config = parseResult.data;
    const allowedCategories = config.classification.categories;
    const failedPostIds = new Set<string>();

    while (true) {
      if (Date.now() - startTime > MAX_DURATION_MS) {
        console.log(`[Cluster] Stopping early - reached time limit of ${MAX_DURATION_MS}ms. More work remains for next run.`);
        stoppedEarly = true;
        break;
      }

      // Fetch a batch of unclustered posts
      const unclusteredPosts = await prisma.rawPost.findMany({
        where: {
          project_id: project.id,
          cluster_id: null,
          id: { notIn: Array.from(failedPostIds) }
        },
        orderBy: { posted_at: 'asc' },
        take: BATCH_SIZE,
      });

      if (unclusteredPosts.length === 0) {
        break; // No more posts for this project
      }

      console.log(`Processing batch of ${unclusteredPosts.length} posts...`);
      const touchedClusterIds = new Set<string>();

      for (const post of unclusteredPosts) {
        try {
          // Known scaling limitation: if a project has >100 clusters, we only fetch the 100 most recently
          // reported. A very old, closed cluster might fall out of this window, and the LLM could spawn
          // a duplicate instead of re-attaching to it.
          const topClusters = await prisma.issueCluster.findMany({
            where: { project_id: project.id },
            orderBy: { last_reported_at: 'desc' },
            take: 100,
            select: { id: true, title: true, category: true, summary: true, status: true }
          });

          const validClusterIds = new Set(topClusters.map(c => c.id));

          const result = await classifyAndMatchPost(post.content, allowedCategories, topClusters);
          
          let assignedClusterId: string | null = null;

          if (result.matched_cluster_id) {
            if (!validClusterIds.has(result.matched_cluster_id)) {
              console.error(`  [Post ${post.id}] LLM hallucinated cluster ID ${result.matched_cluster_id}. Skipping post.`);
              totalSkipped++;
              failedPostIds.add(post.id);
              continue; // Skip without writing so it is retried next run
            }

            // Transaction for matching
            await prisma.$transaction(async (tx) => {
              const clusters = await tx.issueCluster.findMany({ where: { id: result.matched_cluster_id!, project_id: project.id }});
              const cluster = clusters[0];
              if (!cluster) throw new Error("Cluster disappeared"); 

              await tx.issueCluster.updateMany({
                where: { id: result.matched_cluster_id!, project_id: project.id },
                data: {
                  post_count: { increment: 1 },
                  last_reported_at: post.posted_at > cluster.last_reported_at ? post.posted_at : cluster.last_reported_at,
                }
              });

              await tx.rawPost.updateMany({
                where: { id: post.id, project_id: project.id },
                data: { cluster_id: result.matched_cluster_id! }
              });
            });

            console.log(`  [Post ${post.id}] Matched to existing cluster ${result.matched_cluster_id}.`);
            assignedClusterId = result.matched_cluster_id;
            totalMatched++;

          } else if (result.is_new_issue) {
            const title = result.suggested_title || "New Uncategorized Issue";
            // Transaction for new cluster
            const newCluster = await prisma.$transaction(async (tx) => {
              const cluster = await tx.issueCluster.create({
                data: {
                  project_id: project.id,
                  title,
                  category: result.category,
                  status: "new",
                  post_count: 1,
                  first_reported_at: post.posted_at,
                  last_reported_at: post.posted_at,
                }
              });

              await tx.statusHistory.create({
                data: {
                  project_id: project.id,
                  cluster_id: cluster.id,
                  status: "new",
                }
              });

              await tx.rawPost.updateMany({
                where: { id: post.id, project_id: project.id },
                data: { cluster_id: cluster.id }
              });

              return cluster;
            });

            console.log(`  [Post ${post.id}] Created new cluster ${newCluster.id} ('${title}').`);
            assignedClusterId = newCluster.id;
            totalNewClusters++;
          } else {
            console.error(`  [Post ${post.id}] Invalid LLM output (neither matched nor new). Skipping.`);
            failedPostIds.add(post.id);
            totalSkipped++;
            continue;
          }
          
          totalPostsProcessed++;
          if (assignedClusterId) {
            touchedClusterIds.add(assignedClusterId);
          }

        } catch (err: any) {
          console.error(`  [Post ${post.id}] Error processing post: ${err.message}. Skipping.`);
          failedPostIds.add(post.id);
          totalSkipped++;
        }
      }

      // Batch-level: regenerate severity and summary exactly once per unique cluster touched
      for (const clusterId of touchedClusterIds) {
        try {
          await updateClusterSeverity(clusterId, project.id);

          const recentClusterPosts = await prisma.rawPost.findMany({
            where: { cluster_id: clusterId, project_id: project.id },
            orderBy: { posted_at: 'desc' },
            take: 10,
            select: { content: true }
          });
          const newSummary = await generateClusterSummary(recentClusterPosts.map(p => p.content));
          await prisma.issueCluster.updateMany({
            where: { id: clusterId, project_id: project.id },
            data: { summary: newSummary }
          });
        } catch (err: any) {
          console.error(`  [Cluster ${clusterId}] Error updating summary/severity: ${err.message}`);
        }
      }
      
      // small delay between batches
      await new Promise(res => setTimeout(res, 1000));
    }
    
    if (stoppedEarly) {
      break;
    }
  }

  console.log(`\n======================================`);
  console.log(`CLUSTERING RUN COMPLETE`);
  console.log(`======================================`);
  console.log(`Total Posts Processed: ${totalPostsProcessed}`);
  console.log(`Total New Clusters: ${totalNewClusters}`);
  console.log(`Total Matched: ${totalMatched}`);
  console.log(`Total Skipped: ${totalSkipped}`);

  return {
    postsProcessed: totalPostsProcessed,
    newClusters: totalNewClusters,
    matched: totalMatched,
    skipped: totalSkipped,
    stoppedEarly,
  };
}

if (require.main === module || process.argv[1]?.endsWith('cluster.ts')) {
  const args = process.argv.slice(2);
  const targetProjectId = args[0] || null;
  
  runClustering(targetProjectId)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
