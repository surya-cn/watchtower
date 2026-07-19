import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSteamDiscussions } from "../../../src/jobs/connectors/steam_discussions";
import * as fs from "fs";
import * as path from "path";

// Mock the global fetch
const originalFetch = global.fetch;

describe("Steam Discussions Connector", () => {
  let sampleHtml = "";

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!sampleHtml) {
      const fixturePath = path.join(__dirname, "../../fixtures/steam_discussions.html");
      sampleHtml = fs.readFileSync(fixturePath, "utf-8");
    }
  });

  it("extracts threads successfully from a valid Steam HTML page", async () => {
    // Mock fetch to return our fixture
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => sampleHtml,
    });

    const since = new Date(0); // Fetch all
    const posts = await fetchSteamDiscussions("https://steamcommunity.com/app/1238840/discussions/", since);
    
    expect(posts.length).toBeGreaterThan(0);
    
    const firstPost = posts[0];
    expect(firstPost.title || firstPost.content).toBeTruthy();
    expect(firstPost.url).toContain("steamcommunity.com");
    expect(firstPost.posted_at).toBeInstanceOf(Date);
    expect(firstPost.source_post_id).toBeTruthy();
    
    // Ensure content contains the title
    expect(firstPost.content).toContain(firstPost.title || "");
    
    // Check that we're scraping the author as well
    expect(firstPost.author).toBeDefined();
  });

  it("handles the 'since' parameter correctly for early exit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => sampleHtml,
    });

    // Pick a date in the distant future so that all threads are skipped
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 10);
    
    const posts = await fetchSteamDiscussions("https://steamcommunity.com/app/1238840/discussions/", futureDate);
    
    // Should break out of the loop and return 0 posts
    expect(posts.length).toBe(0);
  });

  it("handles malformed HTML gracefully", async () => {
    const malformedHtml = "<html><body><h1>Not steam forums</h1></body></html>";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => malformedHtml,
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const since = new Date(0);
    const posts = await fetchSteamDiscussions("https://steamcommunity.com/app/1238840/discussions/", since);
    
    expect(posts.length).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Found 0 threads"));
    
    // If it was large, it would trigger warning
    // We can test the large case:
    const largeMalformedHtml = "<html>" + "a".repeat(60000) + "</html>";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => largeMalformedHtml,
    });
    
    await fetchSteamDiscussions("https://steamcommunity.com/app/1238840/discussions/", since);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("WARNING: Found 0 threads but HTML is large"));
  });

  it("throws an error on non-ok fetch responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
    });

    await expect(fetchSteamDiscussions("https://steamcommunity.com/app/1238840/discussions/", new Date()))
      .rejects.toThrow("Failed to fetch Steam Discussions page");
  });
});
