// UNUSED as of the generic sources change — no longer wired into the orchestrator. Kept for potential future reintroduction of typed, authenticated connectors.
import { SourceConnector, RawPostInput } from "./types";
import { ProjectConfig } from "@/lib/schemas";

export const discordConnector: SourceConnector = {
  name: "discord",
  async fetchPosts(
    config: ProjectConfig["sources"]["discord"],
    since: Date | null
  ): Promise<RawPostInput[]> {
    throw new Error("Discord connector is not yet implemented.");
  },
};
