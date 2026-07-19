// UNUSED as of the generic sources change — no longer wired into the orchestrator. Kept for potential future reintroduction of typed, authenticated connectors.
import { SourceConnector, RawPostInput } from "./types";
import { ProjectConfig } from "@/lib/schemas";

export const twitterConnector: SourceConnector = {
  name: "twitter",
  async fetchPosts(
    config: ProjectConfig["sources"]["twitter"],
    since: Date | null
  ): Promise<RawPostInput[]> {
    throw new Error("Twitter connector is not yet implemented.");
  },
};
