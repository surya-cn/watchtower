// UNUSED as of the generic sources change — no longer wired into the orchestrator. Kept for potential future reintroduction of typed, authenticated connectors.
import { SourceConnector, RawPostInput } from "./types";
import { ProjectConfig } from "@/lib/schemas";

/*
 * BLOCKED: Reddit API now requires manual approval under their Responsible Builder Policy (Nov 2025 change).
 * This connector is code-complete and mock-tested but has not been verified against the live API.
 * Do not enable in production until approval is obtained.
 */

// Internal delay helper
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Store token in memory to reuse across connector invocations in the same job run
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getRedditToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set in the environment");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "AnticheatDashboard/1.0 (by /u/anticheat-dev)",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Failed to authenticate with Reddit API: ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire 1 minute early for safety
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken!;
}

// Handles rate limiting logic
async function fetchWithRateLimit(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "AnticheatDashboard/1.0 (by /u/anticheat-dev)",
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit API error: ${res.status} ${res.statusText}`);
  }

  const remaining = parseFloat(res.headers.get("x-ratelimit-remaining") || "100");
  const resetTime = parseFloat(res.headers.get("x-ratelimit-reset") || "0");

  if (remaining < 1 && resetTime > 0) {
    console.warn(`[Reddit Connector] Rate limit exhausted. Waiting ${resetTime} seconds...`);
    await delay(resetTime * 1000);
  } else if (remaining < 10) {
    // Add a tiny delay if we're getting close
    await delay(1000);
  }

  return res.json();
}

export const redditConnector: SourceConnector = {
  name: "reddit",
  async fetchPosts(
    config: ProjectConfig["sources"]["reddit"],
    since: Date | null
  ): Promise<RawPostInput[]> {
    if (!config || !config.subreddits || config.subreddits.length === 0) {
      return [];
    }

    const token = await getRedditToken();
    const allPosts: RawPostInput[] = [];
    const sinceTime = since ? since.getTime() : 0;

    for (const subreddit of config.subreddits) {
      let after: string | null = null;
      let keepFetching = true;

      while (keepFetching) {
        const url = new URL(`https://oauth.reddit.com/r/${subreddit}/new`);
        url.searchParams.set("limit", "100"); // Fetch max allowed per page
        if (after) {
          url.searchParams.set("after", after);
        }

        const data = await fetchWithRateLimit(url.toString(), token);
        const children = data?.data?.children || [];

        if (children.length === 0) {
          break; // No more posts
        }

        for (const child of children) {
          const post = child.data;
          const postedAt = post.created_utc * 1000;

          // If we reached posts older than our 'since' bound, stop paginating this subreddit
          if (postedAt <= sinceTime) {
            keepFetching = false;
            break;
          }

          allPosts.push({
            source_post_id: post.name, // e.g., t3_1abcdef
            author: post.author,
            content: `${post.title}\n\n${post.selftext || ""}`.trim(),
            url: `https://reddit.com${post.permalink}`,
            posted_at: new Date(postedAt),
          });
        }

        after = data?.data?.after;
        if (!after) {
          keepFetching = false; // End of pagination
        }
      }
    }

    return allPosts;
  },
};
// UNUSED as of the generic sources change — no longer wired into the orchestrator. Kept for potential future reintroduction of typed, authenticated connectors.

