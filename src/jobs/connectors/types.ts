import { ProjectConfig } from "@/lib/schemas";
import { Source } from "@prisma/client";

export type RawPostInput = {
  source_post_id: string;
  author: string | null;
  content: string;
  url: string;
  posted_at: Date;
};

// Represents the structure every connector must implement
export interface SourceConnector {
  name: Source;
  fetchPosts(
    config: ProjectConfig["sources"][keyof ProjectConfig["sources"]],
    since: Date | null
  ): Promise<RawPostInput[]>;
}
