import { randomUUID } from "crypto";
import "dotenv/config";
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { runClustering } from "../../src/jobs/cluster";
import { classifyAndMatchPost, generateClusterSummary } from "../../src/lib/llm";

vi.mock("../../src/lib/llm", () => ({
  classifyAndMatchPost: vi.fn(),
  generateClusterSummary: vi.fn(),
}));


async function setupProject() {
  const projectId = `test-cluster-${randomUUID()}`;
  await prisma.project.create({
    data: {
      id: projectId,
      display_name: "Test Cluster Project",
      config: {
        sources: [],
        keywords: { include: [], exclude: [] },
        classification: {
          categories: ["bug", "exploit", "crash"],
          severity_thresholds: { high: 5, medium: 2 },
        },
        integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
        team_contacts: [],
      },
    },
  });
  return projectId;
}

describe("Cluster Job", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });


  it("should create a new cluster when there is no match", async () => {
    const projectId = await setupProject();
    const post = await prisma.rawPost.create({
      data: {
        project_id: projectId,
        source: "reddit",
        source_post_id: "reddit_1",
        content: "Game crashed!",
        url: "http://reddit.com/1",
        posted_at: new Date("2026-07-10T12:00:00Z"),
      }
    });

    vi.mocked(classifyAndMatchPost).mockResolvedValueOnce({
      category: "crash",
      matched_cluster_id: null,
      is_new_issue: true,
      suggested_title: "Game Crash Issue",
    });

    vi.mocked(generateClusterSummary).mockResolvedValueOnce("Game is crashing for users.");

    await runClustering(projectId);

    const clusters = await prisma.issueCluster.findMany({ where: { project_id: projectId } });
    expect(clusters.length).toBe(1);
    expect(clusters[0].title).toBe("Game Crash Issue");
    expect(clusters[0].category).toBe("crash");
    expect(clusters[0].status).toBe("new");
    expect(clusters[0].post_count).toBe(1);
    expect(clusters[0].severity).toBe("low"); 
    expect(clusters[0].summary).toBe("Game is crashing for users.");

    const updatedPost = await prisma.rawPost.findUnique({ where: { id: post.id, project_id: projectId } });
    expect(updatedPost?.cluster_id).toBe(clusters[0].id);

    const history = await prisma.statusHistory.findMany({ where: { cluster_id: clusters[0].id, project_id: projectId } });
    expect(history.length).toBe(1);
    expect(history[0].status).toBe("new");
  });

  it("should match an existing closed_false_positive cluster and update its severity", async () => {
    const projectId = await setupProject();
    const existingCluster = await prisma.issueCluster.create({
      data: {
        project_id: projectId,
        title: "False ban report",
        category: "bug",
        status: "closed_false_positive",
        post_count: 1,
        first_reported_at: new Date("2026-01-01T00:00:00Z"),
        last_reported_at: new Date("2026-01-01T00:00:00Z"),
      }
    });

    await prisma.rawPost.create({
      data: {
        project_id: projectId,
        source: "reddit",
        source_post_id: "reddit_old",
        content: "I got falsely banned",
        url: "http://reddit.com/old",
        posted_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        cluster_id: existingCluster.id
      }
    });

    const newPost = await prisma.rawPost.create({
      data: {
        project_id: projectId,
        source: "reddit",
        source_post_id: "reddit_new",
        content: "I also got falsely banned just now",
        url: "http://reddit.com/new",
        posted_at: new Date(), 
      }
    });

    vi.mocked(classifyAndMatchPost).mockResolvedValueOnce({
      category: "bug",
      matched_cluster_id: existingCluster.id,
      is_new_issue: false,
      suggested_title: null,
    });

    vi.mocked(generateClusterSummary).mockResolvedValueOnce("More users reporting false bans.");

    await runClustering(projectId);

    const cluster = await prisma.issueCluster.findUnique({ where: { id: existingCluster.id, project_id: projectId } });
    expect(cluster?.post_count).toBe(2);
    expect(cluster?.status).toBe("closed_false_positive");
    expect(cluster?.severity).toBe("medium"); 
    expect(cluster?.summary).toBe("More users reporting false bans.");
    expect(cluster?.last_reported_at.getTime()).toBe(newPost.posted_at.getTime());

    const updatedPost = await prisma.rawPost.findUnique({ where: { id: newPost.id, project_id: projectId } });
    expect(updatedPost?.cluster_id).toBe(existingCluster.id);
  });

  it("should reject a hallucinated cluster ID and leave post unclustered", async () => {
    const projectId = await setupProject();
    const post = await prisma.rawPost.create({
      data: {
        project_id: projectId,
        source: "reddit",
        source_post_id: "reddit_invalid",
        content: "Something is wrong",
        url: "http://reddit.com/invalid",
        posted_at: new Date(),
      }
    });

    vi.mocked(classifyAndMatchPost).mockResolvedValueOnce({
      category: "bug",
      matched_cluster_id: "fake-cluster-id-that-does-not-exist",
      is_new_issue: false,
      suggested_title: null,
    });

    await runClustering(projectId);

    const updatedPost = await prisma.rawPost.findUnique({ where: { id: post.id, project_id: projectId } });
    expect(updatedPost?.cluster_id).toBeNull(); 
  });
  
  it("one LLM failure should not stop the rest of the batch", async () => {
    const projectId = await setupProject();
    const failId = `post_fail_${randomUUID()}`;
    await prisma.rawPost.create({
      data: {
        id: failId,
        project_id: projectId,
        source: "reddit",
        source_post_id: "failing_post",
        content: "Failing post",
        url: "http://fail",
        posted_at: new Date(),
      }
    });

    const successId = `post_success_${randomUUID()}`;
    await prisma.rawPost.create({
      data: {
        id: successId,
        project_id: projectId,
        source: "reddit",
        source_post_id: "success_post",
        content: "Success post",
        url: "http://success",
        posted_at: new Date(),
      }
    });

    vi.mocked(classifyAndMatchPost)
      .mockRejectedValueOnce(new Error("LLM failure"))
      .mockResolvedValueOnce({
        category: "bug",
        matched_cluster_id: null,
        is_new_issue: true,
        suggested_title: "Success Cluster",
      });

    vi.mocked(generateClusterSummary).mockResolvedValue("Summary");

    await runClustering(projectId);

    const failPost = await prisma.rawPost.findUnique({ where: { id: failId, project_id: projectId } });
    expect(failPost?.cluster_id).toBeNull();

    const successPost = await prisma.rawPost.findUnique({ where: { id: successId, project_id: projectId } });
    expect(successPost?.cluster_id).not.toBeNull();

    const clusters = await prisma.issueCluster.findMany({ where: { project_id: projectId } });
    expect(clusters.length).toBe(1);
    expect(clusters[0].title).toBe("Success Cluster");
  });

  it("invalid LLM output (neither new nor matched) should add post to failed tracking and not loop", async () => {
    const projectId = await setupProject();
    const invalidId = `post_invalid_${randomUUID()}`;
    await prisma.rawPost.create({
      data: {
        id: invalidId,
        project_id: projectId,
        source: "reddit",
        source_post_id: "invalid_post",
        content: "Invalid post",
        url: "http://invalid",
        posted_at: new Date(),
      }
    });

    vi.mocked(classifyAndMatchPost)
      .mockResolvedValue({
        category: "bug",
        matched_cluster_id: null,
        is_new_issue: false,
        suggested_title: null,
      });

    // The job loops until no more posts are found. If it doesn't track the failed post,
    // this test will hang (timeout). If it tracks it, the loop terminates.
    await runClustering(projectId);

    const post = await prisma.rawPost.findUnique({ where: { id: invalidId, project_id: projectId } });
    expect(post?.cluster_id).toBeNull();
    // classifyAndMatchPost should only be called once, because the post is skipped and tracked
    expect(classifyAndMatchPost).toHaveBeenCalledTimes(1);
  });

  it("should run summary and severity regeneration exactly once per cluster per batch", async () => {
    const projectId = await setupProject();
    const existingCluster = await prisma.issueCluster.create({
      data: {
        project_id: projectId,
        title: "Test batching",
        category: "bug",
        status: "new",
        post_count: 1,
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      }
    });

    // Create 3 posts in the same project that need clustering
    for (let i = 0; i < 3; i++) {
      await prisma.rawPost.create({
        data: {
          id: `batch_post_${projectId}_${i}`,
          project_id: projectId,
          source: "reddit",
          source_post_id: `src_post_${i}`,
          content: `Content ${i}`,
          url: `http://url/${i}`,
          posted_at: new Date(),
        }
      });
    }

    vi.mocked(classifyAndMatchPost).mockResolvedValue({
      category: "bug",
      matched_cluster_id: existingCluster.id,
      is_new_issue: false,
      suggested_title: null,
    });

    vi.mocked(generateClusterSummary).mockResolvedValue("Batch Summary");

    await runClustering(projectId);

    // The LLM should be called 3 times (once per post)
    expect(classifyAndMatchPost).toHaveBeenCalledTimes(3);

    // But the summary generation should only be called ONCE per cluster in that batch
    expect(generateClusterSummary).toHaveBeenCalledTimes(1);

    const cluster = await prisma.issueCluster.findUnique({ where: { id: existingCluster.id, project_id: projectId } });
    expect(cluster?.summary).toBe("Batch Summary");
    expect(cluster?.post_count).toBe(4);
  });
});
