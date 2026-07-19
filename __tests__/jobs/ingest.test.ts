import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { runIngest } from "@/jobs/ingest";
import { Source } from "@prisma/client";

// Mock the generic fetcher since runIngest dynamically imports it
vi.mock("@/jobs/connectors/generic", () => ({
  fetchGenericSource: vi.fn(),
}));

import { fetchGenericSource } from "@/jobs/connectors/generic";

beforeAll(async () => {
  // Setup a test project config explicitly
  await prisma.project.upsert({
    where: { id: "test-ingest" },
    update: {},
    create: {
      id: "test-ingest",
      display_name: "Test Ingest",
      config: {
        sources: [
          { name: "Reddit", url: "https://reddit.com/r/test1.rss" },
          { name: "EA Forum", url: "http://test.com/feed" }
        ],
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
  
  // Reset mock
  vi.mocked(fetchGenericSource).mockResolvedValue([]);
});

describe("Orchestrator Logic", () => {
  it("filters out posts based on keyword include/exclude", async () => {
    vi.mocked(fetchGenericSource).mockImplementation(async (url) => {
      if (url === "https://reddit.com/r/test1.rss") {
        return [
          { source_post_id: "p1", author: "a1", content: "some aimbot text", url: "url1", posted_at: new Date() }, // keep (include)
          { source_post_id: "p2", author: "a2", content: "some hack but legit", url: "url2", posted_at: new Date() }, // drop (exclude)
          { source_post_id: "p3", author: "a3", content: "irrelevant stuff", url: "url3", posted_at: new Date() }, // drop (no include)
        ];
      }
      return [];
    });

    await runIngest("test-ingest");

    const posts = await prisma.rawPost.findMany({ where: { project_id: "test-ingest" } });
    expect(posts).toHaveLength(1);
    expect(posts[0].source_post_id).toBe("p1");
  });

  it("does not double-insert duplicates (deduplication)", async () => {
    vi.mocked(fetchGenericSource).mockImplementation(async (url) => {
      if (url === "https://reddit.com/r/test1.rss") {
        return [
          { source_post_id: "p1", author: "a1", content: "some aimbot text", url: "url1", posted_at: new Date() },
        ];
      }
      return [];
    });

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
    vi.mocked(fetchGenericSource).mockImplementation(async (url) => {
      if (url === "https://reddit.com/r/test1.rss") {
        throw new Error("Simulated network error");
      }
      if (url === "http://test.com/feed") {
        return [
          { source_post_id: "ea1", author: "ea1", content: "aimbot report", url: "url", posted_at: new Date() },
        ];
      }
      return [];
    });

    await runIngest("test-ingest");

    const posts = await prisma.rawPost.findMany({ where: { project_id: "test-ingest" } });
    expect(posts).toHaveLength(1);
    expect(posts[0].source_post_id).toBe("ea1");
    // Since EA Forum URL does not match known sources, it defaults to ea_forum enum in our new logic
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
    expect(vi.mocked(fetchGenericSource)).toHaveBeenCalledWith("https://reddit.com/r/test1.rss", oldDate);
    expect(vi.mocked(fetchGenericSource)).toHaveBeenCalledWith("http://test.com/feed", newerDate);
  });
});

describe("Connector Mappings (Unit)", () => {
  it("Generic connector maps JSON and RSS data correctly", async () => {
    // Unmock fetchGenericSource just for this block since we want to test its real logic
    const { fetchGenericSource: realGenericFetch } = await vi.importActual<any>("@/jobs/connectors/generic");

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
      const jsonPosts = await realGenericFetch("http://json.com", null);
      expect(jsonPosts).toHaveLength(1);
      expect(jsonPosts[0].source_post_id).toBe("j1");
      expect(jsonPosts[0].content).toBe("J\n\njson body");

      const rssPosts = await realGenericFetch("http://rss.com", null);
      expect(rssPosts).toHaveLength(1);
      expect(rssPosts[0].source_post_id).toBe("r1");
      expect(rssPosts[0].content).toBe("R\n\nrss body"); 
    } finally {
      global.fetch = originalFetch;
    }
  });
});
