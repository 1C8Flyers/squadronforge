import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  tenant: { findMany: vi.fn(), create: vi.fn() },
  tenantUser: { findUnique: vi.fn() }
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

describe('admin input validation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid admin user create payload', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });
    const app = createApp();

    const res = await request(app)
      .post('/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'bad-email', password: 'short', systemRole: 'user' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('rejects invalid admin tenant create payload', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });
    const app = createApp();

    const res = await request(app)
      .post('/admin/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
        slug: 'x',
        orgid: 'not-number',
        unitOnly: true,
        timezone: 'America/Chicago',
        syncScheduleCron: '0 */4 * * *',
        credentialsRef: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(prismaMock.tenant.create).not.toHaveBeenCalled();
  });
});
