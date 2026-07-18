import "dotenv/config";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";

const testProjectId = "mw-test-project";

beforeAll(async () => {
  // Create a unique test project and seeded data for middleware tests
  await prisma.project.create({
    data: {
      id: testProjectId,
      display_name: "MW Test Project",
      config: { sources: { reddit: null, twitter: null, ea_forum: null, discord: null } },
    }
  });

  await prisma.issueCluster.create({
    data: {
      id: "mw-test-cluster",
      project_id: testProjectId,
      title: "Test",
      summary: "Test",
      category: "aimbot",
      severity: "low",
      status: "new",
      post_count: 1,
      first_reported_at: new Date(),
      last_reported_at: new Date(),
    }
  });
  
  await prisma.rawPost.create({
    data: {
      project_id: testProjectId,
      cluster_id: "mw-test-cluster",
      source: "reddit",
      source_post_id: "mw-test-post",
      content: "test",
      author: "test",
      url: "http://example.com",
      posted_at: new Date()
    }
  });
});

afterAll(async () => {
  await prisma.rawPost.deleteMany({ where: { project_id: testProjectId } });
  await prisma.issueCluster.deleteMany({ where: { project_id: testProjectId } });
  await prisma.project.deleteMany({ where: { id: testProjectId } });
  await prisma.$disconnect();
});

describe("multi-tenancy enforcement via $extends", () => {
  // ─── Default branch (reads/updates/deletes): must have project_id in where ───

  it("throws on issueCluster.findMany without project_id in where", async () => {
    await expect(
      prisma.issueCluster.findMany({ where: {} })
    ).rejects.toThrow("Multi-tenancy violation");
  });

  it("throws on issueCluster.findFirst without project_id in where", async () => {
    await expect(
      prisma.issueCluster.findFirst({ where: { category: "aimbot" } })
    ).rejects.toThrow("Multi-tenancy violation");
  });

  it("throws on rawPost.count without project_id in where", async () => {
    await expect(
      prisma.rawPost.count({ where: {} })
    ).rejects.toThrow("Multi-tenancy violation");
  });

  it("throws on statusHistory.findMany without project_id in where", async () => {
    await expect(
      prisma.statusHistory.findMany({ where: {} })
    ).rejects.toThrow("Multi-tenancy violation");
  });

  // ─── Create branch: must have project_id in data ───

  it("throws on rawPost.create without project_id in data", async () => {
    await expect(
      prisma.rawPost.create({
        data: {
          source: "reddit",
          source_post_id: "test-middleware-001",
          content: "This should be blocked",
          url: "https://reddit.com/r/test",
          posted_at: new Date(),
        } as any,
      })
    ).rejects.toThrow("Multi-tenancy violation");
  });

  // ─── Positive cases: queries WITH project_id succeed ───

  it("allows issueCluster.findMany WITH project_id in where", async () => {
    const result = await prisma.issueCluster.findMany({
      where: { project_id: testProjectId },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("allows rawPost.count WITH project_id in where", async () => {
    const count = await prisma.rawPost.count({
      where: { project_id: testProjectId },
    });
    expect(typeof count).toBe("number");
  });

  // ─── Nested write behavior (documented limitation) ───

  it("does NOT intercept nested raw_posts created through issueCluster.create", async () => {
    // Prisma $extends query interceptors only fire for top-level operations.
    // Nested writes bypass the raw_posts interceptor.
    // Safety relies on: parent interceptor + required field + FK constraint.
    const result = await prisma.issueCluster.create({
      data: {
        project_id: testProjectId,
        title: "Nested write test",
        summary: "Testing nested create behavior",
        category: "exploit",
        severity: "low",
        status: "new",
        first_reported_at: new Date(),
        last_reported_at: new Date(),
        raw_posts: {
          create: {
            project_id: testProjectId,
            source: "reddit",
            source_post_id: "nested-test-" + Date.now(),
            content: "Nested write test post",
            author: "author",
            url: "https://reddit.com/r/test/nested-test",
            posted_at: new Date(),
          },
        },
      },
      include: { raw_posts: true },
    });

    expect(result.raw_posts).toHaveLength(1);
    expect(result.raw_posts[0].project_id).toBe(testProjectId);

    // Cleanup
    await prisma.rawPost.deleteMany({
      where: { project_id: testProjectId, source_post_id: result.raw_posts[0].source_post_id },
    });
    await prisma.issueCluster.deleteMany({
      where: { project_id: testProjectId, id: result.id },
    });
  });

  // ─── updateMany compound-where validation ───

  it("executes updateMany with { id, project_id } compound where without error", async () => {
    const issue = await prisma.issueCluster.findFirst({
      where: { project_id: testProjectId },
    });
    expect(issue).not.toBeNull();

    const result = await prisma.issueCluster.updateMany({
      where: { id: issue!.id, project_id: testProjectId },
      data: { status: issue!.status }, // no-op update
    });

    expect(result.count).toBe(1);
  });

  it("updateMany with valid ID but wrong project_id updates zero rows", async () => {
    const issue = await prisma.issueCluster.findFirst({
      where: { project_id: testProjectId },
    });
    expect(issue).not.toBeNull();

    const result = await prisma.issueCluster.updateMany({
      where: { id: issue!.id, project_id: "wrong-project-id" },
      data: { status: issue!.status },
    });

    expect(result.count).toBe(0);
  });
});
