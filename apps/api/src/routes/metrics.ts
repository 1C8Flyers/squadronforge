import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const metricsRouter = Router();

metricsRouter.get('/', async (_req, res) => {
  const [tenantCount, memberCount, runCount, lastRun, tenantLastSync] = await Promise.all([
    prisma.tenant.count({ where: { isEnabled: true } }),
    prisma.member.count(),
    prisma.syncRun.count(),
    prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { startedAt: true, status: true } }),
    prisma.tenant.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        slug: true,
        name: true,
        syncRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            startedAt: true,
            status: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
  ]);

  res.json({
    tenantCount,
    memberCount,
    runCount,
    lastRunAt: lastRun?.startedAt ?? null,
    lastRunStatus: lastRun?.status ?? null,
    tenantLastSync: tenantLastSync.map((tenant) => ({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      lastRunAt: tenant.syncRuns[0]?.startedAt ?? null,
      lastRunStatus: tenant.syncRuns[0]?.status ?? null
    }))
  });
});
