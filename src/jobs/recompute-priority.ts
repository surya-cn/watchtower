import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { updateClusterPriority } from "./priority";

async function main() {
  const args = process.argv.slice(2);
  const projectId = args[0];

  if (!projectId) {
    console.error("Usage: npm run recompute-priority -- <project_id>");
    process.exit(1);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    console.error(`Project ${projectId} not found.`);
    process.exit(1);
  }

  const clusters = await prisma.issueCluster.findMany({
    where: { project_id: projectId },
    select: { id: true },
  });

  console.log(`Recomputing priority for ${clusters.length} clusters in project ${projectId}...`);

  for (const cluster of clusters) {
    try {
      const result = await updateClusterPriority(cluster.id, projectId);
      console.log(`[${cluster.id}] Priority: ${result.priorityScore} (Recurrence Ratio: ${result.recurrenceRatio})`);
    } catch (error) {
      console.error(`[${cluster.id}] Error: ${error}`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
