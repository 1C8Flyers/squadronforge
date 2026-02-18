import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  tenantUser: { findUnique: vi.fn() },
  member: { count: vi.fn(), findMany: vi.fn() },
  syncRun: { findFirst: vi.fn(), findMany: vi.fn() },
  dutyPosition: { count: vi.fn(), findMany: vi.fn() }
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock
}));

import { ensureTenantAccess, tenantScopedDb } from '../src/lib/tenant-scope.js';

describe('tenant scope helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows system admin tenant access', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'systemAdmin' });

    const tenantId = await ensureTenantAccess('user-1', 'rockford');

    expect(tenantId).toBe('tenant-1');
    expect(prismaMock.tenantUser.findUnique).not.toHaveBeenCalled();
  });

  it('denies non-assigned user tenant access', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: 'user' });
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);

    await expect(ensureTenantAccess('user-1', 'rockford')).rejects.toThrow('Tenant access denied');
  });

  it('enforces tenantId in scoped member queries', async () => {
    prismaMock.member.count.mockResolvedValue(0);

    const scoped = tenantScopedDb('tenant-enforced');
    await scoped.member.count({ where: { tenantId: 'other-tenant', status: 'ACTIVE' as const } });

    const call = prismaMock.member.count.mock.calls[0]?.[0];
    expect(call.where.tenantId).toBe('tenant-enforced');
    expect(call.where.status).toBe('ACTIVE');
  });
});
