import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { connectors } from "./connectors";
import { RawPostInput } from "./connectors/types";
import { ProjectConfigSchema, ProjectConfig } from "@/lib/schemas";

export async function runIngest(targetProjectId: string | null = null) {
  const projects = await prisma.project.findMany({
    where: targetProjectId ? { id: targetProjectId } : undefined,
  });

  if (projects.length === 0) {
    console.log(`No projects found${targetProjectId ? ` matching ID: ${targetProjectId}` : ""}.`);
    return;
  }

  let totalProjectsProcessed = 0;
  let totalPostsInserted = 0;
  const errors: string[] = [];

  for (const project of projects) {
    totalProjectsProcessed++;
    console.log(`\n======================================`);
    console.log(`Processing Project: ${project.id}`);
    console.log(`======================================`);

    const parseResult = ProjectConfigSchema.safeParse(project.config);
    if (!parseResult.success) {
      const msg = `[Project ${project.id}] Invalid config structure, skipping.`;
      console.error(msg);
      errors.push(msg);
      continue;
    }
    const config = parseResult.data;

    for (const [sourceName, connector] of Object.entries(connectors)) {
      const sourceConfig = config.sources[sourceName as keyof ProjectConfig["sources"]];
      
      console.log(`[Project ${project.id}] Starting connector: ${sourceName}`);

      if (!sourceConfig) {
        console.log(`  -> Skipping ${sourceName} for ${project.id}: not configured`);
        continue;
      }

      if (sourceName === "reddit") {
        if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
          console.log(`  -> Skipping reddit for ${project.id}: missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET`);
          continue;
        }
      }

      try {
        const lastPost = await prisma.rawPost.aggregate({
          _max: { posted_at: true },
          where: {
            project_id: project.id,
            source: sourceName as any,
          },
        });
        const since = lastPost._max.posted_at;

        const fetchedPosts: RawPostInput[] = await connector.fetchPosts(sourceConfig as any, since);

        if (fetchedPosts.length === 0) {
          console.log(`  -> Fetched 0 posts (since: ${since ? since.toISOString() : "beginning"}).`);
          continue;
        }

        const includes = config.keywords.include.map((k) => k.toLowerCase());
        const excludes = config.keywords.exclude.map((k) => k.toLowerCase());

        const filteredPosts = fetchedPosts.filter((post) => {
          const content = post.content.toLowerCase();
          // Empty include array means "match everything" (no include filter applied)
          const hasInclude = includes.length === 0 || includes.some((k) => content.includes(k));
          const hasExclude = excludes.some((k) => content.includes(k));
          return hasInclude && !hasExclude;
        });

        let insertedCount = 0;
        if (filteredPosts.length > 0) {
          const insertData = filteredPosts.map((post) => ({
            project_id: project.id,
            source: sourceName as any,
            source_post_id: post.source_post_id,
            author: post.author,
            content: post.content,
            url: post.url,
            posted_at: post.posted_at,
          }));

          const result = await prisma.rawPost.createMany({
            data: insertData,
            skipDuplicates: true,
          });
          insertedCount = result.count;
          totalPostsInserted += insertedCount;
        }

        const duplicates = filteredPosts.length - insertedCount;
        console.log(
          `  -> Fetched: ${fetchedPosts.length} | Filtered: ${filteredPosts.length} (passed) | Duplicates: ${duplicates} | Inserted: ${insertedCount}`
        );
      } catch (err: any) {
        const msg = `[Project ${project.id}] Connector '${sourceName}' failed: ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }
  }

  console.log(`\n======================================`);
  console.log(`INGESTION RUN COMPLETE`);
  console.log(`======================================`);
  console.log(`Total Projects Processed: ${totalProjectsProcessed}`);
  console.log(`Total Posts Inserted: ${totalPostsInserted}`);
  if (errors.length > 0) {
    console.log(`\nErrors encountered:`);
    errors.forEach((err) => console.log(` - ${err}`));
  } else {
    console.log(`\nNo errors encountered.`);
  }
}

// Check if this script is being run directly from the CLI
if (require.main === module || process.argv[1]?.endsWith('ingest.ts')) {
  const args = process.argv.slice(2);
  const targetProjectId = args[0] || null;
  
  runIngest(targetProjectId)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
