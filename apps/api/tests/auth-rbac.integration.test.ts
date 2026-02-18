import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn()
  },
  tenant: { findUnique: vi.fn() },
  tenantUser: { findUnique: vi.fn() },
  syncRun: { findFirst: vi.fn() },
  member: { count: vi.fn() },
  $transaction: vi.fn()
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
let signRefreshToken: (typeof import('../src/lib/auth.js'))['signRefreshToken'];

beforeAll(async () => {
  ({ createApp } = await import('../src/app.js'));
  ({ signAccessToken, signRefreshToken } = await import('../src/lib/auth.js'));
});

const hash = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

describe('auth and RBAC integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in and returns access + refresh tokens', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      systemRole: 'systemAdmin',
      passwordHash: await bcrypt.hash('Password123!', 4)
    });
    prismaMock.refreshToken.create.mockResolvedValue({});

    const app = createApp();
    const res = await request(app).post('/auth/login').send({ email: 'admin@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(prismaMock.refreshToken.create).toHaveBeenCalledOnce();
  });

  it('refreshes tokens with rotation', async () => {
    const sourceToken = signRefreshToken({ userId: 'user-1', tokenId: 'rt-1' });

    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hash(sourceToken),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', systemRole: 'user' });
    prismaMock.$transaction.mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).post('/auth/refresh').send({ refreshToken: sourceToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('revokes refresh tokens on logout', async () => {
    const access = signAccessToken({ userId: 'user-1', systemRole: 'user' });
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const app = createApp();
    const res = await request(app).post('/auth/logout').set('Authorization', `Bearer ${access}`).send();

    expect(res.status).toBe(204);
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledOnce();
  });

  it('denies tenant access when user is not assigned', async () => {
    const access = signAccessToken({ userId: 'user-2', systemRole: 'user' });

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', slug: 'rockford', timezone: 'America/Chicago', syncScheduleCron: '0 * * * *' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'user' });
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/tenant/rockford/dashboard').set('Authorization', `Bearer ${access}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/denied/i);
  });

  it('allows system admin tenant dashboard access', async () => {
    const access = signAccessToken({ userId: 'admin-1', systemRole: 'systemAdmin' });

    prismaMock.tenant.findUnique
      .mockResolvedValueOnce({ id: 'tenant-1', slug: 'rockford' })
      .mockResolvedValueOnce({ syncScheduleCron: '0 * * * *', timezone: 'America/Chicago' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'systemAdmin' });
    prismaMock.syncRun.findFirst.mockResolvedValue({ startedAt: new Date(), status: 'success' });
    prismaMock.member.count.mockResolvedValueOnce(10).mockResolvedValueOnce(9);

    const app = createApp();
    const res = await request(app).get('/tenant/rockford/dashboard').set('Authorization', `Bearer ${access}`);

    expect(res.status).toBe(200);
    expect(res.body.memberCount).toBe(10);
    expect(res.body.activeCount).toBe(9);
    expect(res.body.nextRunAt).toBeTruthy();
  });
});
