import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { RawPostInput } from "./connectors/types";
import { ProjectConfigSchema, ProjectConfig } from "@/lib/schemas";

export interface IngestResult {
  projectsProcessed: number;
  postsInserted: number;
  errors: string[];
  stoppedEarly: boolean;
}

export async function runIngest(targetProjectId: string | null = null, maxDurationMs: number = 45000): Promise<IngestResult> {
  const startTime = Date.now();
  let stoppedEarly = false;
  const projects = await prisma.project.findMany({
    where: targetProjectId ? { id: targetProjectId } : undefined,
  });

  if (projects.length === 0) {
    console.log(`No projects found${targetProjectId ? ` matching ID: ${targetProjectId}` : ""}.`);
    return { projectsProcessed: 0, postsInserted: 0, errors: [], stoppedEarly: false };
  }

  let totalProjectsProcessed = 0;
  let totalPostsInserted = 0;
  const errors: string[] = [];

  for (const project of projects) {
    if (Date.now() - startTime > maxDurationMs) {
      console.log(`[Ingest] Stopping early - reached time limit of ${maxDurationMs}ms. More work remains for next run.`);
      stoppedEarly = true;
      break;
    }

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

    for (const sourceConfig of config.sources) {
      if (Date.now() - startTime > maxDurationMs) {
        console.log(`[Ingest] Stopping early - reached time limit of ${maxDurationMs}ms. More work remains for next run.`);
        stoppedEarly = true;
        break;
      }

      console.log(`[Project ${project.id}] Fetching posts from: ${sourceConfig.name}`);

      try {
        // Derive source enum from URL for database compatibility
        const urlLower = sourceConfig.url.toLowerCase();
        let dbSource: any = "ea_forum";
        if (urlLower.includes("reddit.com")) dbSource = "reddit";
        else if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) dbSource = "twitter";
        else if (urlLower.includes("discord.com")) dbSource = "discord";
        else if (urlLower.includes("steam")) dbSource = "steam";

        const lastPost = await prisma.rawPost.aggregate({
          _max: { posted_at: true },
          where: {
            project_id: project.id,
            source: dbSource,
          },
        });
        const since = lastPost._max.posted_at;

        // Use generic connector for all sources
        const { fetchGenericSource } = await import("./connectors/generic");
        
        let fetchedPosts: RawPostInput[] = [];
        
        try {
          fetchedPosts = await fetchGenericSource(sourceConfig.url, since);
        } catch (fetchErr: any) {
          if (fetchErr.message && fetchErr.message.includes("no supported parsing strategy")) {
            // Fallback to Steam Connector if applicable
            const urlLower = sourceConfig.url.toLowerCase();
            if (urlLower.includes("steamcommunity.com") && urlLower.includes("/discussions")) {
              const { fetchSteamDiscussions } = await import("./connectors/steam_discussions");
              fetchedPosts = await fetchSteamDiscussions(sourceConfig.url, since);
            } else {
              // Not a steam URL, and JSON/RSS failed.
              throw fetchErr;
            }
          } else {
            // A network or other fatal error
            throw fetchErr;
          }
        }

        if (fetchedPosts.length === 0) {
          console.log(`  -> Fetched 0 posts (since: ${since ? since.toISOString() : "beginning"}).`);
          continue;
        }

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const includesRegex = config.keywords.include.map((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i'));
        const excludesRegex = config.keywords.exclude.map((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i'));

        const filteredPosts = fetchedPosts.filter((post) => {
          const content = post.content; // Regex 'i' flag handles case
          const hasInclude = includesRegex.length === 0 || includesRegex.some((r) => r.test(content));
          const hasExclude = excludesRegex.some((r) => r.test(content));
          return hasInclude && !hasExclude;
        });

        let insertedCount = 0;
        if (filteredPosts.length > 0) {
          const insertData = filteredPosts.map((post) => ({
            project_id: project.id,
            source: dbSource,
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
        const msg = `[Project ${project.id}] Failed to fetch from '${sourceConfig.name}': ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }
    
    if (stoppedEarly) {
      break;
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

  return {
    projectsProcessed: totalProjectsProcessed,
    postsInserted: totalPostsInserted,
    errors,
    stoppedEarly,
  };
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
