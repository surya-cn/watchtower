import "dotenv/config";
import { GET } from "@/app/api/metrics/trend/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

describe("GET /api/metrics/trend", () => {
  const project1Id = "trend-test-project-1";
  const project2Id = "trend-test-project-2";
  const category1 = "trend_overlap_category";

  beforeAll(async () => {
    // 1. Create two projects
    const defaultConfig = {
      sources: [],
      keywords: { include: [], exclude: [] },
      classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } },
      integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
      team_contacts: [],
    };
    await prisma.project.deleteMany({
      where: { id: { in: [project1Id, project2Id] } },
    });
    
    await prisma.project.create({
      data: { id: project1Id, display_name: "Trend Test 1", config: defaultConfig },
    });
    
    await prisma.project.create({
      data: { id: project2Id, display_name: "Trend Test 2", config: defaultConfig },
    });

    // 2. Create clusters for both projects with the SAME category
    const cluster1 = await prisma.issueCluster.create({
      data: {
        id: "trend-cluster-1",
        project_id: project1Id,
        title: "Test 1",
        summary: "Sum 1",
        category: category1,
        severity: "medium",
        status: "new",
        post_count: 1,
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      },
    });

    const cluster2 = await prisma.issueCluster.create({
      data: {
        id: "trend-cluster-2",
        project_id: project2Id,
        title: "Test 2",
        summary: "Sum 2",
        category: category1, // Same category
        severity: "medium",
        status: "new",
        post_count: 1,
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      },
    });

    // 3. Create raw posts for cluster 1
    await prisma.rawPost.create({
      data: {
        project_id: project1Id,
        cluster_id: cluster1.id,
        source: "reddit",
        author: "author1",
        content: "Content 1",
        url: "http://example.com/1",
        source_post_id: "test-post-1",
        posted_at: new Date(),
      },
    });

    // 4. Create raw posts for cluster 2
    await prisma.rawPost.create({
      data: {
        project_id: project2Id,
        cluster_id: cluster2.id,
        source: "reddit",
        author: "author2",
        content: "Content 2",
        url: "http://example.com/2",
        source_post_id: "test-post-2",
        posted_at: new Date(),
      },
    });

    // 5. Create an unclustered post for project 1
    await prisma.rawPost.create({
      data: {
        project_id: project1Id,
        cluster_id: null,
        source: "reddit",
        author: "author3",
        content: "Unclustered Content",
        url: "http://example.com/unclustered",
        source_post_id: "test-post-unclustered",
        posted_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.rawPost.deleteMany({
      where: { project_id: { in: [project1Id, project2Id] } },
    });
    await prisma.issueCluster.deleteMany({
      where: { project_id: { in: [project1Id, project2Id] } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [project1Id, project2Id] } },
    });
  });

  it("should return trend data strictly isolated to the requested project", async () => {
    const req = new NextRequest(new URL("http://localhost/api/metrics/trend"), {
      headers: { "X-Project-Id": project1Id },
    });

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.series).toBeDefined();

    // Check that we only get data for project1's post count
    const totalCount = json.series.reduce((sum: number, pt: any) => sum + pt.count, 0);

    // Project 1 has 1 clustered post and 1 unclustered post.
    // Unclustered posts MUST be excluded.
    // Project 2 has 1 clustered post with the same category.
    // So the total count must be exactly 1.
    expect(totalCount).toBe(1);
  });

  it("should exclude posts with null cluster_id from trend results", async () => {
    const req = new NextRequest(new URL("http://localhost/api/metrics/trend"), {
      headers: { "X-Project-Id": project1Id },
    });

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.series).toBeDefined();

    // Verify the unclustered post was excluded
    // If it wasn't excluded, it might show up with a null/undefined category
    const hasNullCategory = json.series.some((pt: any) => !pt.category || pt.category === "undefined");
    expect(hasNullCategory).toBe(false);
  });
});
