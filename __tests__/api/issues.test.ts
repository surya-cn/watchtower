import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// We test API routes by calling the route handlers directly via fetch
// against a running Next.js dev server. Tests assume seed data is present.
// For a real test suite we'd use a test DB, but for Phase 1 this validates
// the contract against seeded data.

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

function api(path: string, options?: RequestInit & { projectId?: string }) {
  const { projectId, ...fetchOptions } = options || {};
  const headers: Record<string, string> = {
    cookie: testCookie,
    "content-type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (projectId) {
    headers["x-project-id"] = projectId;
  }
  return fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers });
}

describe("GET /api/issues — pagination", () => {
  it("returns correct pagination with page_size=2", async () => {
    const res = await api("/api/issues?page_size=2&page=1", {
      projectId: "javelin",
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data).toHaveLength(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.page_size).toBe(2);
    // javelin has 5 issue clusters
    expect(body.pagination.total_count).toBe(5);
    expect(body.pagination.total_pages).toBe(3); // ceil(5/2) = 3
  });

  it("page 2 returns different results than page 1", async () => {
    const res1 = await api("/api/issues?page_size=2&page=1", {
      projectId: "javelin",
    });
    const res2 = await api("/api/issues?page_size=2&page=2", {
      projectId: "javelin",
    });
    const body1 = await res1.json();
    const body2 = await res2.json();

    const ids1 = body1.data.map((d: any) => d.id);
    const ids2 = body2.data.map((d: any) => d.id);

    // No overlapping IDs between pages
    const overlap = ids1.filter((id: string) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("last page may have fewer items", async () => {
    const res = await api("/api/issues?page_size=2&page=3", {
      projectId: "javelin",
    });
    const body = await res.json();
    // 5 items / page_size 2 = page 3 has 1 item
    expect(body.data).toHaveLength(1);
  });
});

describe("GET /api/issues — filters", () => {
  it("filters by status", async () => {
    const res = await api("/api/issues?status=escalated", {
      projectId: "javelin",
    });
    const body = await res.json();

    expect(body.data.length).toBeGreaterThan(0);
    body.data.forEach((issue: any) => {
      expect(issue.status).toBe("escalated");
    });
  });

  it("filters by severity", async () => {
    const res = await api("/api/issues?severity=high", {
      projectId: "javelin",
    });
    const body = await res.json();

    expect(body.data.length).toBeGreaterThan(0);
    body.data.forEach((issue: any) => {
      expect(issue.severity).toBe("high");
    });
  });

  it("filters by category", async () => {
    const res = await api("/api/issues?category=aimbot", {
      projectId: "javelin",
    });
    const body = await res.json();

    expect(body.data.length).toBeGreaterThan(0);
    body.data.forEach((issue: any) => {
      expect(issue.category).toBe("aimbot");
    });
  });

  it("filters by comma-separated status values", async () => {
    const res = await api("/api/issues?status=active,escalated", {
      projectId: "javelin",
    });
    const body = await res.json();

    expect(body.data.length).toBeGreaterThan(0);
    body.data.forEach((issue: any) => {
      expect(["active", "escalated"]).toContain(issue.status);
    });
  });
});

describe("GET /api/issues — tenant isolation", () => {
  it("javelin issues never appear in demo-title queries", async () => {
    const javelinRes = await api("/api/issues?page_size=50", {
      projectId: "javelin",
    });
    const demoRes = await api("/api/issues?page_size=50", {
      projectId: "demo-title",
    });
    const javelinBody = await javelinRes.json();
    const demoBody = await demoRes.json();

    const javelinIds = new Set(javelinBody.data.map((d: any) => d.id));
    const demoIds = new Set(demoBody.data.map((d: any) => d.id));

    // No overlapping IDs
    for (const id of demoIds) {
      expect(javelinIds.has(id)).toBe(false);
    }
  });

  it("filtering aimbot+high returns ONLY the correct project's issues", async () => {
    // Both projects have aimbot/high clusters
    const javelinRes = await api(
      "/api/issues?category=aimbot&severity=high",
      { projectId: "javelin" }
    );
    const demoRes = await api(
      "/api/issues?category=aimbot&severity=high",
      { projectId: "demo-title" }
    );
    const javelinBody = await javelinRes.json();
    const demoBody = await demoRes.json();

    expect(javelinBody.data.length).toBeGreaterThan(0);
    expect(demoBody.data.length).toBeGreaterThan(0);

    // IDs must be completely different
    const javelinIds = new Set(javelinBody.data.map((d: any) => d.id));
    for (const issue of demoBody.data) {
      expect(javelinIds.has(issue.id)).toBe(false);
    }
  });
});

describe("GET /api/issues/:id — cross-project access", () => {
  it("returns 404 (not middleware error) when issue belongs to different project", async () => {
    // Get a javelin issue ID
    const javelinRes = await api("/api/issues?page_size=1", {
      projectId: "javelin",
    });
    const javelinBody = await javelinRes.json();
    const javelinIssueId = javelinBody.data[0].id;

    // Request it with demo-title's project header
    const res = await api(`/api/issues/${javelinIssueId}`, {
      projectId: "demo-title",
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Issue not found");
    // Must NOT be a middleware violation
    expect(body.error).not.toContain("Multi-tenancy violation");
  });
});

import { prisma } from "../../src/lib/prisma";

describe("PATCH /api/issues/:id/status", () => {
  beforeAll(async () => {
    // Create dedicated project and issue for PATCH test
    await prisma.statusHistory.deleteMany({ where: { project_id: "test-patch-project" } });
    await prisma.issueCluster.deleteMany({ where: { project_id: "test-patch-project" } });
    await prisma.project.delete({ where: { id: "test-patch-project" } }).catch(() => {});
    
    await prisma.project.create({
      data: {
        id: "test-patch-project",
        display_name: "Test Patch Project",
        config: {
          sources: [],
          keywords: { include: [], exclude: [] },
          classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } },
          integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
          team_contacts: [],
        },
      },
    });
    
    await prisma.issueCluster.create({
      data: {
        id: "test-patch-issue-1",
        project_id: "test-patch-project",
        title: "Test Issue",
        category: "test",
        status: "new",
        severity: "high",
        post_count: 1,
        first_reported_at: new Date(),
        last_reported_at: new Date()
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.statusHistory.deleteMany({ where: { project_id: "test-patch-project" } });
      await prisma.issueCluster.deleteMany({ where: { project_id: "test-patch-project" } });
      await prisma.project.delete({ where: { id: "test-patch-project" } }).catch(() => {});
    } catch(e) {
      console.error("DELETE ERROR:", e);
      throw e;
    }
  });

  it("updates status and creates status_history entry", async () => {
    const issueId = "test-patch-issue-1";

    const res = await api(`/api/issues/${issueId}/status`, {
      projectId: "test-patch-project",
      method: "PATCH",
      body: JSON.stringify({
        status: "active",
        note: "Test status update from vitest",
      }),
    });

    const body = await res.json();
    if (res.status !== 200) {
      console.error("PATCH FAILED:", res.status, body);
    }

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    // Verify status_history includes the new entry
    expect(body.status_history).toBeDefined();
    expect(body.status_history.length).toBeGreaterThan(0);
    expect(body.status_history[0].status).toBe("active");
    expect(body.status_history[0].note).toBe(
      "Test status update from vitest"
    );
  });
});

describe("missing X-Project-Id header", () => {
  it("returns 400 on scoped endpoints without header", async () => {
    const res = await api("/api/issues");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("X-Project-Id");
  });
});
