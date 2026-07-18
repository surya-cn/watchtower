import { SourceConnector, RawPostInput } from "./types";
import { ProjectConfig } from "@/lib/schemas";
import Parser from "rss-parser";

const parser = new Parser();

export const eaForumConnector: SourceConnector = {
  name: "ea_forum",
  async fetchPosts(
    config: ProjectConfig["sources"]["ea_forum"],
    since: Date | null
  ): Promise<RawPostInput[]> {
    if (!config || !config.urls || config.urls.length === 0) {
      return [];
    }

    const allPosts: RawPostInput[] = [];
    const sinceTime = since ? since.getTime() : 0;

    for (const url of config.urls) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "AnticheatDashboard/1.0",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch forum feed at ${url}: ${res.statusText}`);
        }

        const rawText = await res.text();
        let items: any[] = [];
        let isJson = false;

        // Try parsing as JSON first
        try {
          const parsedJson = JSON.parse(rawText);
          isJson = true;
          // Standard JSON feed format has an 'items' array
          items = parsedJson.items || [];
        } catch (e) {
          // If JSON parse fails, fall back to RSS/Atom parsing
          isJson = false;
        }

        if (!isJson) {
          try {
            const feed = await parser.parseString(rawText);
            items = feed.items || [];
          } catch (rssError) {
            console.error(`[EA Forum Connector] Failed to parse both JSON and RSS for URL: ${url}`);
            continue; // Skip this feed if unparsable
          }
        }

        for (const item of items) {
          let postedAt: Date;
          let id: string;
          let author: string;
          let content: string;
          let itemUrl: string;

          if (isJson) {
            postedAt = new Date(item.date_published || item.date_modified || Date.now());
            id = item.id || item.url;
            author = item.author?.name || "Unknown";
            content = `${item.title || ""}\n\n${item.content_text || item.content_html || ""}`.trim();
            itemUrl = item.url;
          } else {
            postedAt = new Date(item.pubDate || item.isoDate || Date.now());
            id = item.guid || item.id || item.link;
            author = item.creator || item.author || "Unknown";
            content = `${item.title || ""}\n\n${item.contentSnippet || item.content || ""}`.trim();
            itemUrl = item.link;
          }

          if (postedAt.getTime() <= sinceTime) {
            continue; // Skip items older than our 'since' bound
          }

          if (!id || !itemUrl) {
            continue; // Skip malformed items
          }

          allPosts.push({
            source_post_id: id,
            author,
            content,
            url: itemUrl,
            posted_at: postedAt,
          });
        }
      } catch (err) {
        console.error(`[EA Forum Connector] Network or fatal error fetching URL: ${url}`, err);
        // Continue to the next URL
      }
    }

    return allPosts;
  },
};
