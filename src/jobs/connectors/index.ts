import { SourceConnector } from "./types";
import { twitterConnector } from "./twitter";
import { discordConnector } from "./discord";
import { redditConnector } from "./reddit";
import { eaForumConnector } from "./ea_forum";

export const connectors: Record<string, SourceConnector> = {
  twitter: twitterConnector,
  discord: discordConnector,
  reddit: redditConnector,
  ea_forum: eaForumConnector,
};
