import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export const ensureTenantAccess = async (userId: string, tenantSlug: string): Promise<string> => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  if (user?.systemRole === 'systemAdmin') {
    return tenant.id;
  }

  const assignment = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } }
  });

  if (!assignment) {
    throw new Error('Tenant access denied');
  }

  return tenant.id;
};

export const tenantScopedDb = (tenantId: string) => ({
  member: {
    count: (args?: Omit<Prisma.MemberCountArgs, 'where'> & { where?: Prisma.MemberWhereInput }) =>
      prisma.member.count({
        ...args,
        where: {
          ...(args?.where ?? {}),
          tenantId
        }
      }),
    findMany: (args?: Omit<Prisma.MemberFindManyArgs, 'where'> & { where?: Prisma.MemberWhereInput }) =>
      prisma.member.findMany({
        ...args,
        where: {
          ...(args?.where ?? {}),
          tenantId
        }
      })
  },
  syncRun: {
    findMany: (args?: Omit<Prisma.SyncRunFindManyArgs, 'where'> & { where?: Prisma.SyncRunWhereInput }) =>
      prisma.syncRun.findMany({
        ...args,
        where: {
          ...(args?.where ?? {}),
          tenantId
        }
      }),
    findFirst: (args?: Omit<Prisma.SyncRunFindFirstArgs, 'where'> & { where?: Prisma.SyncRunWhereInput }) =>
      prisma.syncRun.findFirst({
        ...args,
        where: {
          ...(args?.where ?? {}),
          tenantId
        }
      })
  },
  dutyPosition: {
    count: (args?: Omit<Prisma.DutyPositionCountArgs, 'where'> & { where?: Prisma.DutyPositionWhereInput }) =>
      prisma.dutyPosition.count({
        ...args,
        where: {
          ...(args?.where ?? {}),
          tenantId
        }
      }),
    findMany: (args?: Omit<Prisma.DutyPositionFindManyArgs, 'where'> & { where?: Prisma.DutyPositionWhereInput }) =>
      prisma.dutyPosition.findMany({
        ...args,
        where: {
          ...(args?.where ?? {}),
          tenantId
        }
      })
  }
});
