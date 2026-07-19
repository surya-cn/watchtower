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
            sources: [],
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
      sources: [{ name: "test", url: "not-a-url" }],
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
          p.includes("url") ||
          p.includes("severity_thresholds") ||
          p.includes("high")
      )
    ).toBe(true);
  });

  it("accepts a valid config", async () => {
    const validConfig = {
      sources: [{ name: "Reddit", url: "https://reddit.com" }],
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
    expect(body.sources[0].url).toEqual("https://reddit.com");
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
            sources: [],
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
          sources: [],
          keywords: { include: [], exclude: [] },
          classification: {
            categories: ["test"],
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

  it("fails with a clear validation error if categories is submitted empty on CREATE", async () => {
    const res = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        id: "new-project-empty-cat",
        display_name: "New Project Empty Cat",
        config: {
          sources: [{ name: "Reddit", url: "https://reddit.com" }],
          keywords: { include: ["test"], exclude: [] },
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

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    const paths = body.details.map((d: any) => d.path);
    expect(paths).toContain("config.classification.categories");
  });

  it("correctly pre-loads and can update an existing project's categories on EDIT", async () => {
    // We already have "test-api-project" from beforeAll with categories: ["test"]
    // We'll update it to have categories: ["updated-category"]
    const res = await api("/api/projects/test-api-project/config", {
      method: "PUT",
      body: JSON.stringify({
        sources: [{ name: "Reddit", url: "https://reddit.com" }],
        keywords: { include: ["test"], exclude: [] },
        classification: {
          categories: ["updated-category", "second-category"],
          severity_thresholds: { high: 50, medium: 20 },
        },
        integrations: {
          bug_tracker: null,
          bug_tracker_project_key: null,
          webhook_url: null,
        },
        team_contacts: [],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.classification.categories).toEqual(["updated-category", "second-category"]);
  });
});

describe("DELETE /api/projects/:id", () => {
  beforeAll(async () => {
    try {
      // Create project 1 to delete
      await prisma.project.delete({ where: { id: "delete-test-1" } }).catch(() => {});
      await prisma.project.create({
        data: {
          id: "delete-test-1",
          display_name: "To Be Deleted",
          config: { sources: [], keywords: { include: [], exclude: [] }, classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } }, integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null }, team_contacts: [] },
        },
      });

      // Insert cascaded records for project 1
      const cluster1 = await prisma.issueCluster.create({
        data: {
          id: "cluster-delete-1",
          project_id: "delete-test-1",
          title: "Delete Me",
          category: "test",
          first_reported_at: new Date(),
          last_reported_at: new Date(),
        }
      });
      await prisma.rawPost.create({
        data: {
          project_id: "delete-test-1",
          cluster_id: cluster1.id,
          source: "reddit",
          source_post_id: "del1",
          content: "Delete me post",
          url: "http://del",
          posted_at: new Date(),
        }
      });
      await prisma.statusHistory.create({
        data: {
          project_id: "delete-test-1",
          cluster_id: cluster1.id,
          status: "new",
        }
      });

      // Create project 2 for isolation
      await prisma.project.delete({ where: { id: "delete-test-2" } }).catch(() => {});
      await prisma.project.create({
        data: {
          id: "delete-test-2",
          display_name: "Isolation Test",
          config: { sources: [], keywords: { include: [], exclude: [] }, classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } }, integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null }, team_contacts: [] },
        },
      });

      const cluster2 = await prisma.issueCluster.create({
        data: {
          id: "cluster-delete-2",
          project_id: "delete-test-2",
          title: "Keep Me",
          category: "test",
          first_reported_at: new Date(),
          last_reported_at: new Date(),
        }
      });
      await prisma.rawPost.create({
        data: {
          project_id: "delete-test-2",
          cluster_id: cluster2.id,
          source: "reddit",
          source_post_id: "keep1",
          content: "Keep me post",
          url: "http://keep",
          posted_at: new Date(),
        }
      });
      await prisma.statusHistory.create({
        data: {
          project_id: "delete-test-2",
          cluster_id: cluster2.id,
          status: "new",
        }
      });
    } catch(e) {
      console.error("CREATE ERROR in DELETE test:", e);
      throw e;
    }
  });

  afterAll(async () => {
    // We clean up project 2, project 1 should already be deleted by the test
    await prisma.statusHistory.deleteMany({ where: { project_id: "delete-test-2" } }).catch(() => {});
    await prisma.rawPost.deleteMany({ where: { project_id: "delete-test-2" } }).catch(() => {});
    await prisma.issueCluster.deleteMany({ where: { project_id: "delete-test-2" } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: "delete-test-2" } }).catch(() => {});
  });

  it("returns 404 for non-existent project", async () => {
    const res = await api("/api/projects/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("successfully deletes the project and cascaded records without affecting other projects", async () => {
    // 1. Delete project 1
    const res = await api("/api/projects/delete-test-1", { method: "DELETE" });
    expect(res.status).toBe(200);

    // 2. Verify all 4 tables have 0 rows for project 1
    const p1 = await prisma.project.findUnique({ where: { id: "delete-test-1" } });
    expect(p1).toBeNull();
    const clusters1 = await prisma.issueCluster.count({ where: { project_id: "delete-test-1" } });
    expect(clusters1).toBe(0);
    const posts1 = await prisma.rawPost.count({ where: { project_id: "delete-test-1" } });
    expect(posts1).toBe(0);
    const statuses1 = await prisma.statusHistory.count({ where: { project_id: "delete-test-1" } });
    expect(statuses1).toBe(0);

    // 3. Verify tenant isolation: project 2 remains untouched
    const p2 = await prisma.project.findUnique({ where: { id: "delete-test-2" } });
    expect(p2).not.toBeNull();
    const clusters2 = await prisma.issueCluster.count({ where: { project_id: "delete-test-2" } });
    expect(clusters2).toBeGreaterThan(0);
    const posts2 = await prisma.rawPost.count({ where: { project_id: "delete-test-2" } });
    expect(posts2).toBeGreaterThan(0);
    const statuses2 = await prisma.statusHistory.count({ where: { project_id: "delete-test-2" } });
    expect(statuses2).toBeGreaterThan(0);
  });
});
