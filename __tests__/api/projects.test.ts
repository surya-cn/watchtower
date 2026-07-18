import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "../../src/lib/prisma";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let testCookie = "";

beforeAll(async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
  });
  testCookie = res.headers.get('set-cookie') || "";
});

function api(path: string, options?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      cookie: testCookie,
      ...(options?.headers || {}),
    },
  });
}

describe("PUT /api/projects/:id/config — validation", () => {
  beforeAll(async () => {
    try {
      await prisma.project.delete({ where: { id: "test-api-project" } }).catch(() => {});
      await prisma.project.create({
        data: {
          id: "test-api-project",
          display_name: "Test API Project",
          config: {
            sources: { reddit: null, twitter: null, ea_forum: null, discord: null },
            keywords: { include: [], exclude: [] },
            classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } },
            integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
            team_contacts: [],
          },
        },
      });
    } catch(e) {
      console.error("CREATE ERROR:", e);
      throw e;
    }
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: "test-api-project" } }).catch(() => {});
  });

  it("rejects a config missing required fields with descriptive errors", async () => {
    const invalidConfig = {
      // Missing: sources, keywords, classification, integrations, team_contacts
    };

    const res = await api("/api/projects/test-api-project/config", {
      method: "PUT",
      body: JSON.stringify(invalidConfig),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);

    // Each detail should have path and message
    body.details.forEach((detail: any) => {
      expect(detail).toHaveProperty("path");
      expect(detail).toHaveProperty("message");
    });

    // Should specifically mention missing top-level fields
    const paths = body.details.map((d: any) => d.path);
    expect(paths).toContain("sources");
  });

  it("rejects a config with wrong field types", async () => {
    const invalidConfig = {
      sources: {
        reddit: { subreddits: "not-an-array" }, // should be string[]
        twitter: null,
        ea_forum: null,
        discord: null,
      },
      keywords: { include: [], exclude: [] },
      classification: {
        categories: [],
        severity_thresholds: { high: "not-a-number", medium: 20 },
      },
      integrations: {
        bug_tracker: null,
        bug_tracker_project_key: null,
        webhook_url: null,
      },
      team_contacts: [],
    };

    const res = await api("/api/projects/test-api-project/config", {
      method: "PUT",
      body: JSON.stringify(invalidConfig),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");

    // Should mention specific field paths
    const paths = body.details.map((d: any) => d.path);
    expect(
      paths.some(
        (p: string) =>
          p.includes("subreddits") ||
          p.includes("severity_thresholds") ||
          p.includes("high")
      )
    ).toBe(true);
  });

  it("accepts a valid config", async () => {
    const validConfig = {
      sources: {
        reddit: { subreddits: ["test"] },
        twitter: null,
        ea_forum: null,
        discord: null,
      },
      keywords: { include: ["test"], exclude: [] },
      classification: {
        categories: ["test"],
        severity_thresholds: { high: 50, medium: 20 },
      },
      integrations: {
        bug_tracker: null,
        bug_tracker_project_key: null,
        webhook_url: null,
      },
      team_contacts: ["test@test.dev"],
    };

    const res = await api("/api/projects/test-api-project/config", {
      method: "PUT",
      body: JSON.stringify(validConfig),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources.reddit.subreddits).toEqual(["test"]);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await api("/api/projects/nonexistent/config");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/projects — creation", () => {
  beforeAll(async () => {
    try {
      await prisma.project.delete({ where: { id: "test-api-project" } }).catch(() => {});
      await prisma.project.create({
        data: {
          id: "test-api-project",
          display_name: "Test API Project",
          config: {
            sources: { reddit: null, twitter: null, ea_forum: null, discord: null },
            keywords: { include: [], exclude: [] },
            classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } },
            integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
            team_contacts: [],
          },
        },
      });
    } catch(e) {
      console.error("CREATE ERROR in POST test:", e);
      throw e;
    }
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: "test-api-project" } }).catch(() => {});
  });

  it("returns 409 for duplicate project ID", async () => {
    const res = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        id: "test-api-project", // already exists from beforeAll
        display_name: "Duplicate",
        config: {
          sources: {
            reddit: null,
            twitter: null,
            ea_forum: null,
            discord: null,
          },
          keywords: { include: [], exclude: [] },
          classification: {
            categories: [],
            severity_thresholds: { high: 50, medium: 20 },
          },
          integrations: {
            bug_tracker: null,
            bug_tracker_project_key: null,
            webhook_url: null,
          },
          team_contacts: [],
        },
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });
});
