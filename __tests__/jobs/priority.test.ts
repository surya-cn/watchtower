import "dotenv/config";
import { updateClusterPriority } from "@/jobs/priority";
import { prisma } from "@/lib/prisma";

describe("updateClusterPriority", () => {
  const projectId = "priority-test-project";

  beforeAll(async () => {
    const defaultConfig = {
      sources: { reddit: null, twitter: null, ea_forum: null, discord: null },
      keywords: { include: [], exclude: [] },
      classification: { categories: ["test"], severity_thresholds: { high: 50, medium: 20 } },
      integrations: { bug_tracker: null, bug_tracker_project_key: null, webhook_url: null },
      team_contacts: [],
    };
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.project.create({
      data: { id: projectId, display_name: "Priority Test Project", config: defaultConfig },
    });
  });

  afterAll(async () => {
    await prisma.statusHistory.deleteMany({ where: { project_id: projectId } });
    await prisma.rawPost.deleteMany({ where: { project_id: projectId } });
    await prisma.issueCluster.deleteMany({ where: { project_id: projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  beforeEach(async () => {
    await prisma.statusHistory.deleteMany({ where: { project_id: projectId } });
    await prisma.rawPost.deleteMany({ where: { project_id: projectId } });
    await prisma.issueCluster.deleteMany({ where: { project_id: projectId } });
  });

  const createTestCluster = async (severity: string, status: string = "new") => {
    const cluster = await prisma.issueCluster.create({
      data: {
        project_id: projectId,
        title: "Test Priority",
        summary: "Testing priority calculation",
        category: "bug",
        severity,
        status,
        post_count: 0,
        first_reported_at: new Date(),
        last_reported_at: new Date(),
      },
    });
    return cluster.id;
  };

  const createPost = async (clusterId: string, daysAgo: number) => {
    const now = new Date();
    await prisma.rawPost.create({
      data: {
        project_id: projectId,
        cluster_id: clusterId,
        source: "reddit",
        author: "user",
        content: "test",
        url: "http",
        source_post_id: `test-post-${Math.random()}`,
        posted_at: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  };

  const createClosureEvent = async (clusterId: string, status: string, daysAgo: number) => {
    const now = new Date();
    await prisma.statusHistory.create({
      data: {
        project_id: projectId,
        cluster_id: clusterId,
        status,
        changed_at: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  };

  it("should calculate correct severity weight", async () => {
    const lowId = await createTestCluster("low");
    const mediumId = await createTestCluster("medium");
    const highId = await createTestCluster("high");

    const lowResult = await updateClusterPriority(lowId, projectId);
    const mediumResult = await updateClusterPriority(mediumId, projectId);
    const highResult = await updateClusterPriority(highId, projectId);

    expect(lowResult.priorityScore).toBe(10); // low = 1, 1*10 = 10
    expect(mediumResult.priorityScore).toBe(20); // medium = 2, 2*10 = 20
    expect(highResult.priorityScore).toBe(30); // high = 3, 3*10 = 30
  });

  it("should calculate recency count for posts in the last 7 days", async () => {
    const clusterId = await createTestCluster("low"); // base = 10
    
    // 2 posts in the last 7 days (daysAgo=2, daysAgo=5)
    await createPost(clusterId, 2);
    await createPost(clusterId, 5);
    
    // 1 post outside the 7-day window (daysAgo=10)
    await createPost(clusterId, 10);

    const result = await updateClusterPriority(clusterId, projectId);
    
    // recency = 2 posts * 2 = 4
    // total = 10 + 4 = 14
    expect(result.priorityScore).toBe(14);
  });

  it("should set recurrence ratio to 0 for open status clusters", async () => {
    const clusterId = await createTestCluster("low", "active"); // base = 10
    
    // Add some posts
    await createPost(clusterId, 10);
    await createPost(clusterId, 5);
    
    // Add an event, but it's not a closure status
    await createClosureEvent(clusterId, "escalated", 7);

    const result = await updateClusterPriority(clusterId, projectId);
    
    expect(result.recurrenceRatio).toBe(0);
    // score = 10 (base) + 1*2 (1 recent post) = 12
    expect(result.priorityScore).toBe(12);
  });

  it("should calculate recurrence ratio for closed clusters with posts before and after", async () => {
    const clusterId = await createTestCluster("low", "fixed"); // base = 10
    
    await createClosureEvent(clusterId, "fixed", 10); // anchor at 10 days ago

    // 2 posts before (12, 15 days ago)
    await createPost(clusterId, 12);
    await createPost(clusterId, 15);
    
    // 1 post after (5 days ago) -> also recent (so +2 for recent)
    await createPost(clusterId, 5);

    const result = await updateClusterPriority(clusterId, projectId);
    
    // ratio = 1 (after) / 2 (before) = 0.5
    expect(result.recurrenceRatio).toBe(0.5);
    // score = 10 (base) + 2 (1 recent post * 2) + 0.5 * 50 (recurrence) = 37
    expect(result.priorityScore).toBe(37);
  });

  it("should drastically increase priority for high-recurrence scenarios (e.g. medal-clipper)", async () => {
    const clusterId = await createTestCluster("high", "resolved"); // base = 30
    
    await createClosureEvent(clusterId, "resolved", 14); // anchor at 14 days ago

    // 1 post before
    await createPost(clusterId, 20);
    
    // 5 posts after (say 2 recent, 3 not recent)
    await createPost(clusterId, 10);
    await createPost(clusterId, 9);
    await createPost(clusterId, 8);
    await createPost(clusterId, 2);
    await createPost(clusterId, 1);

    const result = await updateClusterPriority(clusterId, projectId);
    
    // ratio = 5 (after) / 1 (before) = 5.0
    expect(result.recurrenceRatio).toBe(5.0);
    
    // score = 30 (high severity) + 4 (2 recent posts) + (5.0 * 50) = 284
    expect(result.priorityScore).toBe(284);
  });

  it("should use the most recent closure event if multiple closure events exist", async () => {
    const clusterId = await createTestCluster("low", "fixed");
    
    // Event 1: 30 days ago
    await createClosureEvent(clusterId, "fixed", 30);
    // Event 2: 10 days ago (MOST RECENT)
    await createClosureEvent(clusterId, "resolved", 10);

    // 1 post before most recent (15 days ago)
    await createPost(clusterId, 15);
    // 2 posts after most recent (5 days ago)
    await createPost(clusterId, 5);
    await createPost(clusterId, 5);

    const result = await updateClusterPriority(clusterId, projectId);
    
    // 2 / 1 = 2.0 (if it used the 30-days-ago event, it would be 0 before and 3 after)
    expect(result.recurrenceRatio).toBe(2.0);
  });

  it("should correctly calculate the combined formula", async () => {
    const clusterId = await createTestCluster("medium", "closed_false_positive"); // base = 20
    
    await createClosureEvent(clusterId, "closed_false_positive", 10);

    // 4 posts before (within window of 10 days, so 10 to 20 days ago)
    await createPost(clusterId, 11);
    await createPost(clusterId, 12);
    await createPost(clusterId, 13);
    await createPost(clusterId, 14);

    // 2 posts after, in last 7 days
    await createPost(clusterId, 4);
    await createPost(clusterId, 5);

    const result = await updateClusterPriority(clusterId, projectId);
    
    expect(result.recurrenceRatio).toBe(0.5); // 2 / 4
    
    // Combined = 20 (base) + 4 (2 recent) + 25 (0.5 * 50) = 49
    expect(result.priorityScore).toBe(49);
  });
});
