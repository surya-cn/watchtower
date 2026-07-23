import { NextRequest } from "next/server";
import { GET } from "@/app/api/issues/[id]/similar/route";
import { prisma } from "@/lib/prisma";
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// Mock the NextRequest
function createRequest(projectId: string | null) {
  const headers = new Headers();
  if (projectId) {
    headers.set("x-project-id", projectId);
  }
  return new NextRequest("http://localhost/api/issues/1/similar", {
    headers,
  });
}

describe("GET /api/issues/[id]/similar", () => {
  beforeEach(async () => {
    // Clear out relevant tables before each test
    await prisma.$executeRawUnsafe('DELETE FROM "status_history"');
    await prisma.$executeRawUnsafe('DELETE FROM "raw_posts"');
    await prisma.$executeRawUnsafe('DELETE FROM "issue_clusters"');
    await prisma.$executeRawUnsafe('DELETE FROM "project_access"');
    await prisma.$executeRawUnsafe('DELETE FROM "projects"');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 400 if x-project-id is missing", async () => {
    const req = createRequest(null);
    const res = await GET(req, { params: Promise.resolve({ id: "some-id" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 if the cluster does not exist or belongs to another project", async () => {
    // Setup a project and a cluster
    const project1 = await prisma.project.create({
      data: {
        id: "project-1",
        display_name: "Project 1",
        config: {},
      }
    });
    
    const project2 = await prisma.project.create({
      data: {
        id: "project-2",
        display_name: "Project 2",
        config: {},
      }
    });

    const cluster = await prisma.issueCluster.create({
      data: {
        id: "cluster-1",
        project_id: "project-1",
        title: "Test Cluster",
        category: "bug",
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      }
    });

    // Requesting as project-2 should return 404
    const req = createRequest("project-2");
    const res = await GET(req, { params: Promise.resolve({ id: "cluster-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns similar posts, skipping the first (latest) one", async () => {
    const project = await prisma.project.create({
      data: {
        id: "project-similar",
        display_name: "Project Similar",
        config: {},
      }
    });

    const cluster = await prisma.issueCluster.create({
      data: {
        id: "cluster-similar",
        project_id: "project-similar",
        title: "Similar Test",
        category: "bug",
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      }
    });

    // Create 3 posts
    // Post 3 is the newest
    await prisma.rawPost.create({
      data: {
        id: "post-1",
        project_id: "project-similar",
        cluster_id: "cluster-similar",
        source: "reddit",
        source_post_id: "sp1",
        content: "Oldest post",
        url: "http://example.com/1",
        posted_at: new Date("2023-01-01T10:00:00Z"),
      }
    });

    await prisma.rawPost.create({
      data: {
        id: "post-2",
        project_id: "project-similar",
        cluster_id: "cluster-similar",
        source: "reddit",
        source_post_id: "sp2",
        content: "Middle post",
        url: "http://example.com/2",
        posted_at: new Date("2023-01-02T10:00:00Z"),
      }
    });

    await prisma.rawPost.create({
      data: {
        id: "post-3",
        project_id: "project-similar",
        cluster_id: "cluster-similar",
        source: "reddit",
        source_post_id: "sp3",
        content: "Newest post",
        url: "http://example.com/3",
        posted_at: new Date("2023-01-03T10:00:00Z"),
      }
    });

    const req = createRequest("project-similar");
    const res = await GET(req, { params: Promise.resolve({ id: "cluster-similar" }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    // Should return 2 posts (skipping post-3)
    expect(data.length).toBe(2);
    // Should be ordered by posted_at desc
    expect(data[0].id).toBe("post-2");
    expect(data[1].id).toBe("post-1");
  });

  it("handles ties deterministically by ordering by id desc", async () => {
    const project = await prisma.project.create({
      data: {
        id: "project-tie",
        display_name: "Project Tie",
        config: {},
      }
    });

    const cluster = await prisma.issueCluster.create({
      data: {
        id: "cluster-tie",
        project_id: "project-tie",
        title: "Tie Test",
        category: "bug",
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      }
    });

    const sameTime = new Date("2023-01-01T10:00:00Z");

    await prisma.rawPost.create({
      data: {
        id: "post-A", // ID comes alphabetically after post-B? No, it's string sorting.
        project_id: "project-tie",
        cluster_id: "cluster-tie",
        source: "reddit",
        source_post_id: "spA",
        content: "A",
        url: "http://example.com/A",
        posted_at: sameTime,
      }
    });

    await prisma.rawPost.create({
      data: {
        id: "post-B", 
        project_id: "project-tie",
        cluster_id: "cluster-tie",
        source: "reddit",
        source_post_id: "spB",
        content: "B",
        url: "http://example.com/B",
        posted_at: sameTime,
      }
    });

    await prisma.rawPost.create({
      data: {
        id: "post-C", 
        project_id: "project-tie",
        cluster_id: "cluster-tie",
        source: "reddit",
        source_post_id: "spC",
        content: "C",
        url: "http://example.com/C",
        posted_at: sameTime,
      }
    });

    const req = createRequest("project-tie");
    const res = await GET(req, { params: Promise.resolve({ id: "cluster-tie" }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    
    // The query orders by [posted_at desc, id desc]
    // C, B, A order (since 'post-C' > 'post-B' > 'post-A')
    // So 'post-C' is skipped as latest_post.
    // Returned should be post-B and post-A.
    expect(data.length).toBe(2);
    expect(data[0].id).toBe("post-B");
    expect(data[1].id).toBe("post-A");
  });
});
