import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenant: { count: vi.fn(), findMany: vi.fn() },
  member: { count: vi.fn() },
  syncRun: { count: vi.fn(), findFirst: vi.fn() }
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('bullmq', () => ({
  Queue: class Queue {
    add = vi.fn();
  }
}));

let createApp: (typeof import('../src/app.js'))['createApp'];

beforeAll(async () => {
  ({ createApp } = await import('../src/app.js'));
});

describe('metrics integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns global counts with per-tenant last sync details', async () => {
    const now = new Date('2026-02-17T12:00:00.000Z');

    prismaMock.tenant.count.mockResolvedValue(2);
    prismaMock.member.count.mockResolvedValue(155);
    prismaMock.syncRun.count.mockResolvedValue(42);
    prismaMock.syncRun.findFirst.mockResolvedValue({ startedAt: now, status: 'success' });
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: 't1',
        slug: 'rockford',
        name: 'Rockford Composite Squadron',
        syncRuns: [{ startedAt: now, status: 'success' }]
      },
      {
        id: 't2',
        slug: 'example',
        name: 'Example Squadron',
        syncRuns: []
      }
    ]);

    const app = createApp();
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.body.tenantCount).toBe(2);
    expect(res.body.memberCount).toBe(155);
    expect(res.body.runCount).toBe(42);
    expect(Array.isArray(res.body.tenantLastSync)).toBe(true);
    expect(res.body.tenantLastSync).toHaveLength(2);
    expect(res.body.tenantLastSync[0]).toMatchObject({
      tenantId: 't1',
      tenantSlug: 'rockford',
      tenantName: 'Rockford Composite Squadron',
      lastRunStatus: 'success'
    });
    expect(res.body.tenantLastSync[1]).toMatchObject({
      tenantId: 't2',
      tenantSlug: 'example',
      tenantName: 'Example Squadron',
      lastRunAt: null,
      lastRunStatus: null
    });
  });
});
