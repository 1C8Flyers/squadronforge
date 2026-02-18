import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  tenant: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  tenantUser: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() }
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('bullmq', () => ({
  Queue: class Queue {
    add = vi.fn();
  }
}));

process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

let createApp: (typeof import('../src/app.js'))['createApp'];
let signAccessToken: (typeof import('../src/lib/auth.js'))['signAccessToken'];

beforeAll(async () => {
  ({ createApp } = await import('../src/app.js'));
  ({ signAccessToken } = await import('../src/lib/auth.js'));
});

describe('admin and tenant settings authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-system-admin from admin tenants list', async () => {
    const token = signAccessToken({ userId: 'u1', systemRole: 'user' });
    const app = createApp();

    const res = await request(app).get('/admin/tenants').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/system admin required/i);
  });

  it('allows system-admin admin tenants list', async () => {
    const token = signAccessToken({ userId: 'sa1', systemRole: 'systemAdmin' });
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 't1', name: 'Rockford', slug: 'rockford', users: [] }]);

    const app = createApp();
    const res = await request(app).get('/admin/tenants').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prismaMock.tenant.findMany).toHaveBeenCalledOnce();
  });

  it('denies tenant viewer from updating tenant settings', async () => {
    const token = signAccessToken({ userId: 'viewer-1', systemRole: 'user' });

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 't1', slug: 'rockford' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'user' });
    prismaMock.tenantUser.findUnique
      .mockResolvedValueOnce({ tenantId: 't1', userId: 'viewer-1', role: 'tenantViewer' })
      .mockResolvedValueOnce({ tenantId: 't1', userId: 'viewer-1', role: 'tenantViewer' });

    const app = createApp();
    const res = await request(app)
      .patch('/tenant/rockford/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ syncScheduleCron: '0 */6 * * *' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/tenant admin required/i);
  });

  it('allows tenant admin to update tenant settings', async () => {
    const token = signAccessToken({ userId: 'ta-1', systemRole: 'user' });

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 't1', slug: 'rockford' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'user' });
    prismaMock.tenantUser.findUnique
      .mockResolvedValueOnce({ tenantId: 't1', userId: 'ta-1', role: 'tenantAdmin' })
      .mockResolvedValueOnce({ tenantId: 't1', userId: 'ta-1', role: 'tenantAdmin' });
    prismaMock.tenant.update.mockResolvedValue({ id: 't1', syncScheduleCron: '0 */6 * * *' });

    const app = createApp();
    const res = await request(app)
      .patch('/tenant/rockford/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ syncScheduleCron: '0 */6 * * *' });

    expect(res.status).toBe(200);
    expect(prismaMock.tenant.update).toHaveBeenCalledOnce();
  });

  it('allows system admin to update tenant settings without assignment', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 't1', slug: 'rockford' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'systemAdmin' });
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);
    prismaMock.tenant.update.mockResolvedValue({ id: 't1', timezone: 'America/Chicago' });

    const app = createApp();
    const res = await request(app)
      .patch('/tenant/rockford/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'America/Chicago' });

    expect(res.status).toBe(200);
    expect(prismaMock.tenant.update).toHaveBeenCalledOnce();
  });
});
