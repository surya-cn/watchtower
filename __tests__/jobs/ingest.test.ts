import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { runIngest } from "@/jobs/ingest";
import { connectors } from "@/jobs/connectors";
import { redditConnector } from "@/jobs/connectors/reddit";
import { eaForumConnector } from "@/jobs/connectors/ea_forum";
import { Source } from "@prisma/client";

// Save real connectors
const realRedditFetch = connectors.reddit.fetchPosts;
const realEaFetch = connectors.ea_forum.fetchPosts;

// Mock env vars for reddit so it isn't skipped
process.env.REDDIT_CLIENT_ID = "mock";
process.env.REDDIT_CLIENT_SECRET = "mock";

beforeAll(async () => {
  // Setup a test project config explicitly
  await prisma.project.upsert({
    where: { id: "test-ingest" },
    update: {},
    create: {
      id: "test-ingest",
      display_name: "Test Ingest",
      config: {
        sources: {
          reddit: { subreddits: ["test1"] },
          ea_forum: { urls: ["http://test.com/feed"] },
          twitter: null,
          discord: null,
        },
        keywords: {
          include: ["aimbot", "hack"],
          exclude: ["legit"],
        },
        classification: {
          categories: ["aimbot"],
          severity_thresholds: { high: 50, medium: 20 },
        },
        integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
        team_contacts: [],
      },
    },
  });
});

afterAll(async () => {
  await prisma.rawPost.deleteMany({ where: { project_id: "test-ingest" } });
  await prisma.project.delete({ where: { id: "test-ingest" } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.rawPost.deleteMany({ where: { project_id: "test-ingest" } });
  
  // Reset mocks
  connectors.reddit.fetchPosts = vi.fn().mockResolvedValue([]);
  connectors.ea_forum.fetchPosts = vi.fn().mockResolvedValue([]);
});

describe("Orchestrator Logic", () => {
  it("filters out posts based on keyword include/exclude", async () => {
    connectors.reddit.fetchPosts = vi.fn().mockResolvedValue([
      { source_post_id: "p1", author: "a1", content: "some aimbot text", url: "url1", posted_at: new Date() }, // keep (include)
      { source_post_id: "p2", author: "a2", content: "some hack but legit", url: "url2", posted_at: new Date() }, // drop (exclude)
      { source_post_id: "p3", author: "a3", content: "irrelevant stuff", url: "url3", posted_at: new Date() }, // drop (no include)
    ]);

    await runIngest("test-ingest");

    const posts = await prisma.rawPost.findMany({ where: { project_id: "test-ingest" } });
    expect(posts).toHaveLength(1);
    expect(posts[0].source_post_id).toBe("p1");
  });

  it("does not double-insert duplicates (deduplication)", async () => {
    connectors.reddit.fetchPosts = vi.fn().mockResolvedValue([
      { source_post_id: "p1", author: "a1", content: "some aimbot text", url: "url1", posted_at: new Date() },
    ]);

    // Run first time
    await runIngest("test-ingest");
    let posts = await prisma.rawPost.findMany({ where: { project_id: "test-ingest" } });
    expect(posts).toHaveLength(1);

    // Run second time with same data
    await runIngest("test-ingest");
    posts = await prisma.rawPost.findMany({ where: { project_id: "test-ingest" } });
    expect(posts).toHaveLength(1); // Should still be 1
  });

  it("continues processing other sources/projects if one connector fails", async () => {
    connectors.reddit.fetchPosts = vi.fn().mockRejectedValue(new Error("Simulated network error"));
    connectors.ea_forum.fetchPosts = vi.fn().mockResolvedValue([
      { source_post_id: "ea1", author: "ea1", content: "aimbot report", url: "url", posted_at: new Date() },
    ]);

    await runIngest("test-ingest");

    const posts = await prisma.rawPost.findMany({ where: { project_id: "test-ingest" } });
    expect(posts).toHaveLength(1);
    expect(posts[0].source_post_id).toBe("ea1");
    expect(posts[0].source).toBe(Source.ea_forum);
  });

  it("correctly calculates 'since' per project and source", async () => {
    const oldDate = new Date("2026-01-01T00:00:00Z");
    const newerDate = new Date("2026-01-02T00:00:00Z");

    await prisma.rawPost.createMany({
      data: [
        { project_id: "test-ingest", source: Source.reddit, source_post_id: "r1", content: "aimbot", url: "u", posted_at: oldDate },
        { project_id: "test-ingest", source: Source.ea_forum, source_post_id: "ea1", content: "aimbot", url: "u", posted_at: newerDate },
      ]
    });

    await runIngest("test-ingest");

    // Check what dates were passed to connectors
    expect(connectors.reddit.fetchPosts).toHaveBeenCalledWith(expect.any(Object), oldDate);
    expect(connectors.ea_forum.fetchPosts).toHaveBeenCalledWith(expect.any(Object), newerDate);
  });
});

describe("Connector Mappings (Unit)", () => {
  it("Reddit connector maps data correctly", async () => {
    process.env.REDDIT_CLIENT_ID = "mock_client";
    process.env.REDDIT_CLIENT_SECRET = "mock_secret";
    // Mock global fetch for reddit
    const originalFetch = global.fetch;
    
    global.fetch = vi.fn().mockImplementation(async (url: any) => {
      if (url.toString().includes("access_token")) {
        return { ok: true, json: async () => ({ access_token: "mock_token", expires_in: 3600 }) } as any;
      }
      if (url.toString().includes("oauth.reddit.com")) {
        return { 
          ok: true, 
          headers: new Headers({ "x-ratelimit-remaining": "100", "x-ratelimit-reset": "600" }),
          json: async () => ({
            data: {
              children: [
                { data: { name: "t3_123", author: "test_user", title: "Test Title", selftext: "Test Body", permalink: "/r/test/123", created_utc: 1000000 } }
              ],
              after: null
            }
          }) 
        } as any;
      }
      return { ok: false };
    });

    try {
      const posts = await realRedditFetch({ subreddits: ["test"] }, null);
      expect(posts).toHaveLength(1);
      expect(posts[0].source_post_id).toBe("t3_123");
      expect(posts[0].author).toBe("test_user");
      expect(posts[0].content).toBe("Test Title\n\nTest Body");
      expect(posts[0].url).toBe("https://reddit.com/r/test/123");
      expect(posts[0].posted_at.getTime()).toBe(1000000000);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("EA Forum connector maps JSON data correctly and falls back to RSS correctly", async () => {
    const originalFetch = global.fetch;
    
    global.fetch = vi.fn().mockImplementation(async (url: any) => {
      if (url.toString() === "http://json.com") {
        return {
          ok: true,
          text: async () => JSON.stringify({
            items: [
              { id: "j1", url: "http://j.com", author: { name: "ja" }, title: "J", content_text: "json body", date_published: "2026-01-01T00:00:00Z" }
            ]
          })
        } as any;
      }
      if (url.toString() === "http://rss.com") {
        return {
          ok: true,
          text: async () => `<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0"><channel>
              <item>
                <guid>r1</guid>
                <link>http://r.com</link>
                <author>ra</author>
                <title>R</title>
                <description>rss body</description>
                <pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate>
              </item>
            </channel></rss>
          `
        } as any;
      }
      return { ok: false };
    });

    try {
      const jsonPosts = await realEaFetch({ urls: ["http://json.com"] }, null);
      expect(jsonPosts).toHaveLength(1);
      expect(jsonPosts[0].source_post_id).toBe("j1");
      expect(jsonPosts[0].content).toBe("J\n\njson body");

      const rssPosts = await realEaFetch({ urls: ["http://rss.com"] }, null);
      expect(rssPosts).toHaveLength(1);
      expect(rssPosts[0].source_post_id).toBe("r1");
      expect(rssPosts[0].content).toBe("R\n\nrss body"); // rss-parser uses description->contentSnippet for RSS 2.0
    } finally {
      global.fetch = originalFetch;
    }
  });
});
