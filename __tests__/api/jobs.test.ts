import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../src/app/api/jobs/sync/route';
import * as ingestMod from '../../src/jobs/ingest';
import * as clusterMod from '../../src/jobs/cluster';

vi.mock('../../src/jobs/ingest', () => ({
  runIngest: vi.fn(),
}));

vi.mock('../../src/jobs/cluster', () => ({
  runClustering: vi.fn(),
}));

describe('POST /api/jobs/sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 500 if CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost/api/jobs/sync', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-secret'
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Server configuration error');
  });

  it('returns 401 if Authorization header is missing', async () => {
    const req = new Request('http://localhost/api/jobs/sync', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 if Authorization header is incorrect', async () => {
    const req = new Request('http://localhost/api/jobs/sync', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-secret'
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('calls ingest and cluster and returns summary on success', async () => {
    const mockIngestSummary = { projectsProcessed: 1, postsInserted: 5, errors: [], stoppedEarly: false };
    const mockClusterSummary = { postsProcessed: 5, newClusters: 1, matched: 4, skipped: 0, stoppedEarly: false };

    vi.spyOn(ingestMod, 'runIngest').mockResolvedValue(mockIngestSummary);
    vi.spyOn(clusterMod, 'runClustering').mockResolvedValue(mockClusterSummary);

    const req = new Request('http://localhost/api/jobs/sync', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-secret'
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.ingest).toEqual(mockIngestSummary);
    expect(data.cluster).toEqual(mockClusterSummary);
    
    // Ensure ingest was called BEFORE cluster
    const ingestOrder = vi.mocked(ingestMod.runIngest).mock.invocationCallOrder[0];
    const clusterOrder = vi.mocked(clusterMod.runClustering).mock.invocationCallOrder[0];
    
    expect(ingestOrder).toBeLessThan(clusterOrder);
  });

  it('returns 500 if an unexpected error occurs during jobs', async () => {
    vi.spyOn(ingestMod, 'runIngest').mockRejectedValue(new Error("DB failure"));

    const req = new Request('http://localhost/api/jobs/sync', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-secret'
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
    expect(data.details).toBe('DB failure');
  });
});
