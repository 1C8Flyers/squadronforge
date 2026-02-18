import { Router } from 'express';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { requireAuth } from '../middleware/require-auth.js';
import { ensureTenantAccess, tenantScopedDb } from '../lib/tenant-scope.js';
import { prisma } from '../lib/prisma.js';

const queue = new Queue('capwatch-sync', { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } });

export const tenantRouter = Router();
tenantRouter.use(requireAuth);

const buildMemberWhere = (tenantId: string, query: { search?: string; status?: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'; memberType?: 'CADET' | 'SENIOR' | 'UNKNOWN' }) => ({
  tenantId,
  ...(query.search
    ? {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' as const } },
          { lastName: { contains: query.search, mode: 'insensitive' as const } },
          { capid: { contains: query.search, mode: 'insensitive' as const } }
        ]
      }
    : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.memberType ? { memberType: query.memberType } : {})
});

const csvEscape = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

tenantRouter.get('/:slug/dashboard', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const scoped = tenantScopedDb(tenantId);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { syncScheduleCron: true, timezone: true }
  });
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const [lastRun, memberCount, activeCount] = await Promise.all([
    scoped.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    scoped.member.count(),
    scoped.member.count({ where: { status: 'ACTIVE' } })
  ]);

  const nextRunAt = CronExpressionParser.parse(tenant.syncScheduleCron, {
    currentDate: new Date(),
    tz: tenant.timezone
  })
    .next()
    .toDate();

  res.json({ lastRun, memberCount, activeCount, nextRunAt });
});

tenantRouter.get('/:slug/members', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const scoped = tenantScopedDb(tenantId);
  const q = z
    .object({
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().default(25),
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'UNKNOWN']).optional(),
      memberType: z.enum(['CADET', 'SENIOR', 'UNKNOWN']).optional(),
      sortBy: z.enum(['capid', 'grade', 'lastName', 'memberType', 'status', 'unitCharter']).default('lastName'),
      sortDir: z.enum(['asc', 'desc']).default('asc')
    })
    .parse(req.query);

  const where = buildMemberWhere(tenantId, q);
  const sortDir = q.sortDir;
  const memberOrderBy: Record<string, any> = {
    capid: [{ capid: sortDir }],
    grade: [{ grade: sortDir }, { lastName: 'asc' }, { firstName: 'asc' }],
    lastName: [{ lastName: sortDir }, { firstName: sortDir }],
    memberType: [{ memberType: sortDir }, { lastName: 'asc' }, { firstName: 'asc' }],
    status: [{ status: sortDir }, { lastName: 'asc' }, { firstName: 'asc' }],
    unitCharter: [{ unitCharter: sortDir }, { lastName: 'asc' }, { firstName: 'asc' }]
  };

  const [items, total] = await Promise.all([
    scoped.member.findMany({ where, orderBy: memberOrderBy[q.sortBy], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    scoped.member.count({ where })
  ]);

  res.json({ items, total, page: q.page, pageSize: q.pageSize });
});

tenantRouter.get('/:slug/members/export.csv', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const scoped = tenantScopedDb(tenantId);
  const q = z
    .object({
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'UNKNOWN']).optional(),
      memberType: z.enum(['CADET', 'SENIOR', 'UNKNOWN']).optional()
    })
    .parse(req.query);

  const rows = await scoped.member.findMany({
    where: buildMemberWhere(tenantId, q),
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  const headers = ['capid', 'firstName', 'lastName', 'grade', 'memberType', 'status', 'email', 'unitCharter', 'orgid', 'expirationDate'];
  const body = rows
    .map((row: (typeof rows)[number]) =>
      [
        csvEscape(row.capid),
        csvEscape(row.firstName),
        csvEscape(row.lastName),
        csvEscape(row.grade),
        csvEscape(row.memberType),
        csvEscape(row.status),
        csvEscape(row.email),
        csvEscape(row.unitCharter),
        csvEscape(row.orgid),
        csvEscape(row.expirationDate?.toISOString() ?? null)
      ].join(',')
    )
    .join('\n');

  const csv = `${headers.join(',')}\n${body}`;
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="${req.params.slug}-members.csv"`);
  res.send(csv);
});

tenantRouter.get('/:slug/members/:capid', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const capid = z.string().min(1).parse(req.params.capid);

  const member = await prisma.member.findFirst({
    where: {
      tenantId,
      capid
    }
  });

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const [contacts, addresses, duties] = await Promise.all([
    prisma.memberContact.findMany({
      where: { tenantId, capid },
      orderBy: [{ type: 'asc' }, { priority: 'asc' }]
    }),
    prisma.memberAddress.findMany({
      where: { tenantId, capid },
      orderBy: [{ type: 'asc' }, { priority: 'asc' }]
    }),
    prisma.dutyPosition.findMany({
      where: { tenantId, capid },
      orderBy: [{ dutyName: 'asc' }]
    })
  ]);

  res.json({ member, contacts, addresses, duties });
});

tenantRouter.get('/:slug/sync-runs', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const scoped = tenantScopedDb(tenantId);
  const runs = await scoped.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
  res.json(runs);
});

tenantRouter.get('/:slug/duty-positions', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const scoped = tenantScopedDb(tenantId);
  const q = z
    .object({
      capid: z.string().optional(),
      dutyCode: z.string().optional(),
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().default(50),
      sortBy: z.enum(['memberName', 'memberGrade', 'capid', 'dutyName', 'dutyCode', 'startDate', 'endDate']).default('capid'),
      sortDir: z.enum(['asc', 'desc']).default('asc')
    })
    .parse(req.query);

  const where = {
    tenantId,
    ...(q.capid ? { capid: q.capid } : {}),
    ...(q.dutyCode ? { dutyCode: q.dutyCode } : {})
  };

  const [allItems, total] = await Promise.all([scoped.dutyPosition.findMany({ where }), scoped.dutyPosition.count({ where })]);

  const capids = [...new Set(allItems.map((item: (typeof allItems)[number]) => item.capid).filter(Boolean))];
  const membersByCapid = new Map<string, { firstName: string; lastName: string; grade: string | null }>();

  if (capids.length > 0) {
    const members = await scoped.member.findMany({
      where: { capid: { in: capids } },
      select: { capid: true, firstName: true, lastName: true, grade: true }
    });

    for (const member of members) {
      membersByCapid.set(member.capid, { firstName: member.firstName, lastName: member.lastName, grade: member.grade });
    }
  }

  const enrichedItems = allItems.map((item: (typeof allItems)[number]) => {
    const member = membersByCapid.get(item.capid);
    return {
      ...item,
      memberFirstName: member?.firstName ?? null,
      memberLastName: member?.lastName ?? null,
      memberGrade: member?.grade ?? null,
      memberName: member ? `${member.lastName}, ${member.firstName}` : null
    };
  });

  const sortFactor = q.sortDir === 'asc' ? 1 : -1;
  const sorted = [...enrichedItems].sort((a, b) => {
    const compareText = (left?: string | null, right?: string | null): number =>
      (left ?? '').localeCompare(right ?? '', undefined, { sensitivity: 'base' });
    const compareDate = (left?: string | Date | null, right?: string | Date | null): number => {
      const l = left ? new Date(left).getTime() : 0;
      const r = right ? new Date(right).getTime() : 0;
      return l - r;
    };

    let result = 0;
    switch (q.sortBy) {
      case 'memberName':
        result = compareText(a.memberName, b.memberName);
        break;
      case 'memberGrade':
        result = compareText(a.memberGrade, b.memberGrade);
        break;
      case 'capid':
        result = compareText(a.capid, b.capid);
        break;
      case 'dutyName':
        result = compareText(a.dutyName, b.dutyName);
        break;
      case 'dutyCode':
        result = compareText(a.dutyCode, b.dutyCode);
        break;
      case 'startDate':
        result = compareDate(a.startDate, b.startDate);
        break;
      case 'endDate':
        result = compareDate(a.endDate, b.endDate);
        break;
      default:
        result = compareText(a.capid, b.capid);
    }

    if (result === 0) {
      result = compareText(a.capid, b.capid);
    }
    return result * sortFactor;
  });

  const start = (q.page - 1) * q.pageSize;
  const end = start + q.pageSize;
  const pagedItems = sorted.slice(start, end);

  res.json({ items: pagedItems, total, page: q.page, pageSize: q.pageSize });
});

tenantRouter.get('/:slug/cadet-promotions', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const scoped = tenantScopedDb(tenantId);
  const q = z
    .object({
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().default(50),
      search: z.string().optional(),
      ready: z.coerce.boolean().optional(),
      inactive: z.coerce.boolean().optional(),
      sortBy: z
        .enum(['memberName', 'rank', 'capid', 'achievementName', 'datePromotionEligible', 'lastPtDate', 'ready', 'inactive'])
        .default('memberName'),
      sortDir: z.enum(['asc', 'desc']).default('asc')
    })
    .parse(req.query);

  const where = {
    tenantId,
    ...(q.search
      ? {
          OR: [
            { memberName: { contains: q.search, mode: 'insensitive' as const } },
            { capid: { contains: q.search, mode: 'insensitive' as const } },
            { rank: { contains: q.search, mode: 'insensitive' as const } },
            { achievementName: { contains: q.search, mode: 'insensitive' as const } }
          ]
        }
      : {}),
    ...(q.ready === undefined ? {} : { ready: q.ready }),
    ...(q.inactive === undefined ? {} : { inactive: q.inactive })
  };

  const orderByMap: Record<string, any[]> = {
    memberName: [{ memberName: q.sortDir }, { capid: 'asc' }],
    rank: [{ rank: q.sortDir }, { memberName: 'asc' }],
    capid: [{ capid: q.sortDir }],
    achievementName: [{ achievementName: q.sortDir }, { memberName: 'asc' }],
    datePromotionEligible: [{ datePromotionEligible: q.sortDir }, { memberName: 'asc' }],
    lastPtDate: [{ lastPtDate: q.sortDir }, { memberName: 'asc' }],
    ready: [{ ready: q.sortDir }, { memberName: 'asc' }],
    inactive: [{ inactive: q.sortDir }, { memberName: 'asc' }]
  };

  const [items, total, readyCount, inactiveCount] = await Promise.all([
    scoped.cadetPromotion.findMany({
      where,
      orderBy: orderByMap[q.sortBy],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize
    }),
    scoped.cadetPromotion.count({ where }),
    scoped.cadetPromotion.count({ where: { tenantId, ready: true } }),
    scoped.cadetPromotion.count({ where: { tenantId, inactive: true } })
  ]);

  res.json({ items, total, page: q.page, pageSize: q.pageSize, summary: { readyCount, inactiveCount } });
});

tenantRouter.get('/:slug/settings', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      orgid: true,
      unitOnly: true,
      timezone: true,
      syncScheduleCron: true,
      fileMappingJson: true,
      isEnabled: true
    }
  });
  res.json(tenant);
});

tenantRouter.patch('/:slug/settings', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const assignment = await prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId: req.auth!.userId } } });
  if (req.auth?.systemRole !== 'systemAdmin' && assignment?.role !== 'tenantAdmin') {
    throw new Error('Tenant admin required');
  }

  const body = z
    .object({
      orgid: z.number().int().optional(),
      unitOnly: z.boolean().optional(),
      timezone: z.string().optional(),
      syncScheduleCron: z.string().optional(),
      fileMappingJson: z.record(z.string(), z.string()).optional()
    })
    .parse(req.body);

  const updated = await prisma.tenant.update({ where: { id: tenantId }, data: body });
  res.json(updated);
});

tenantRouter.post('/:slug/sync-now', async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await queue.add('sync-tenant', { tenantId: tenant.id }, { removeOnComplete: 25, removeOnFail: 100 });
  res.status(202).json({ enqueued: true });
});
