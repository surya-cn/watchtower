import { prisma } from "./src/lib/prisma";

async function clean() {
  await prisma.rawPost.deleteMany({ where: { source: 'steam', project_id: 'gpte-1' } });
  
  // Clean up orphan clusters that have no posts
  const orphanClusters = await prisma.issueCluster.findMany({
    where: {
      project_id: 'gpte-1',
      raw_posts: {
        none: {}
      }
    }
  });
  
  for (const c of orphanClusters) {
    await prisma.statusHistory.deleteMany({ where: { cluster_id: c.id } });
    await prisma.issueCluster.delete({ where: { id: c.id, project_id: 'gpte-1' } });
  }
  
  console.log('Deleted Steam posts and', orphanClusters.length, 'orphan clusters.');
}

clean().catch(console.error).finally(() => prisma.$disconnect());
