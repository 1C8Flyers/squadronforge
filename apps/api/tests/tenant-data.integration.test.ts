import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  tenantUser: { findUnique: vi.fn() },
  member: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  memberContact: { findMany: vi.fn() },
  memberAddress: { findMany: vi.fn() },
  dutyPosition: { findMany: vi.fn(), count: vi.fn() }
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

describe('tenant data integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 't1', slug: 'rockford' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'systemAdmin' });
  });

  it('applies pagination parameters to members endpoint', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });

    prismaMock.member.findMany.mockResolvedValue([{ capid: '1', firstName: 'Jane', lastName: 'Doe' }]);
    prismaMock.member.count.mockResolvedValue(101);

    const app = createApp();
    const res = await request(app)
      .get('/tenant/rockford/members?page=2&pageSize=50&status=ACTIVE&memberType=CADET')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(50);
    expect(res.body.total).toBe(101);

    const findManyArgs = prismaMock.member.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.skip).toBe(50);
    expect(findManyArgs.take).toBe(50);
    expect(findManyArgs.where.tenantId).toBe('t1');
    expect(findManyArgs.where.status).toBe('ACTIVE');
    expect(findManyArgs.where.memberType).toBe('CADET');
  });

  it('returns CSV with expected headers and attachment filename', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });

    prismaMock.member.findMany.mockResolvedValue([
      {
        capid: '123456',
        firstName: 'Jane',
        lastName: 'Doe',
        memberType: 'CADET',
        status: 'ACTIVE',
        email: 'jane@example.com',
        unitCharter: 'IL-251',
        orgid: 1092,
        expirationDate: new Date('2026-12-31T00:00:00.000Z')
      }
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/tenant/rockford/members/export.csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('rockford-members.csv');
    expect(res.text).toContain('capid,firstName,lastName,memberType,status,email,unitCharter,orgid,expirationDate');
    expect(res.text).toContain('123456,Jane,Doe,CADET,ACTIVE,jane@example.com,IL-251,1092,2026-12-31T00:00:00.000Z');
  });

  it('applies pagination parameters to duty positions endpoint', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });

    prismaMock.dutyPosition.findMany.mockResolvedValue([{ id: 'd1', capid: '123456', dutyName: 'Commander' }]);
    prismaMock.dutyPosition.count.mockResolvedValue(55);
    prismaMock.member.findMany.mockResolvedValue([{ capid: '123456', firstName: 'Jane', lastName: 'Doe' }]);

    const app = createApp();
    const res = await request(app)
      .get('/tenant/rockford/duty-positions?page=2&pageSize=25&capid=123456&dutyCode=CC')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(25);
    expect(res.body.total).toBe(55);
    expect(res.body.items[0].memberName).toBe('Doe, Jane');

    const findManyArgs = prismaMock.dutyPosition.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.skip).toBe(25);
    expect(findManyArgs.take).toBe(25);
    expect(findManyArgs.where.tenantId).toBe('t1');
    expect(findManyArgs.where.capid).toBe('123456');
    expect(findManyArgs.where.dutyCode).toBe('CC');

    const memberFindManyArgs = prismaMock.member.findMany.mock.calls[0]?.[0];
    expect(memberFindManyArgs.where.capid.in).toEqual(['123456']);
  });

  it('returns member details including contact and address records', async () => {
    const token = signAccessToken({ userId: 'sa-1', systemRole: 'systemAdmin' });

    prismaMock.member.findFirst.mockResolvedValue({
      capid: '123456',
      firstName: 'Jane',
      lastName: 'Doe',
      memberType: 'CADET',
      status: 'ACTIVE'
    });
    prismaMock.memberContact.findMany.mockResolvedValue([
      { capid: '123456', type: 'CADET PARENT EMAIL', contact: 'parent@example.com' }
    ]);
    prismaMock.memberAddress.findMany.mockResolvedValue([
      { capid: '123456', type: 'MAIL', addr1: '123 Main St', city: 'Rockford', state: 'IL', zip: '61111' }
    ]);
    prismaMock.dutyPosition.findMany.mockResolvedValue([{ capid: '123456', dutyName: 'Cadet First Sergeant' }]);

    const app = createApp();
    const res = await request(app).get('/tenant/rockford/members/123456').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.member.capid).toBe('123456');
    expect(res.body.contacts[0].type).toBe('CADET PARENT EMAIL');
    expect(res.body.addresses[0].type).toBe('MAIL');
    expect(res.body.duties[0].dutyName).toBe('Cadet First Sergeant');
  });
});
