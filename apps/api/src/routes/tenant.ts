import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { requireAuth } from '../middleware/require-auth.js';
import { ensureTenantAccess, tenantScopedDb } from '../lib/tenant-scope.js';
import { prisma } from '../lib/prisma.js';
import { computeCadetPromotion } from '../lib/promotion/computeCadetPromotion.js';

const queue = new Queue('capwatch-sync', { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } });
const notificationQueue = new Queue('event-notifications', { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } });
const RSVP_LINK_SECRET = process.env.RSVP_LINK_SECRET ?? process.env.JWT_SECRET ?? 'change-me-rsvp-link-secret';

export const tenantRouter = Router();

type SignedRsvpPayload = {
  tenantId: string;
  eventId: string;
  status: 'yes' | 'no' | 'maybe';
  source: 'email-link' | 'push-link';
  exp: number;
  userId?: string;
  capid?: string;
};

const fromBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const verifySignedRsvpToken = (token: string): SignedRsvpPayload | null => {
  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', RSVP_LINK_SECRET).update(encodedPayload).digest('base64url');
  const provided = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload));
    return z
      .object({
        tenantId: z.string().min(1),
        eventId: z.string().min(1),
        status: z.enum(['yes', 'no', 'maybe']),
        source: z.enum(['email-link', 'push-link']),
        exp: z.coerce.number().int().positive(),
        userId: z.string().min(1).optional(),
        capid: z.string().min(1).optional()
      })
      .parse(parsed);
  } catch {
    return null;
  }
};

const rsvpActionHtml = (title: string, message: string): string => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
      .card { max-width: 560px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
      h1 { margin: 0 0 8px 0; font-size: 20px; }
      p { margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;

tenantRouter.get('/rsvp/:token', async (req, res) => {
  const payload = verifySignedRsvpToken(req.params.token);
  if (!payload) {
    return res.status(400).send(rsvpActionHtml('Invalid RSVP link', 'This RSVP link is invalid. Please request a new notification link.'));
  }

  if (Date.now() > payload.exp * 1000) {
    return res.status(410).send(rsvpActionHtml('RSVP link expired', 'This RSVP link has expired. Please use the app to update your RSVP.'));
  }

  const event = await prisma.event.findFirst({
    where: { tenantId: payload.tenantId, id: payload.eventId },
    select: { id: true, title: true, isCancelled: true }
  });

  if (!event) {
    return res.status(404).send(rsvpActionHtml('Event not found', 'This event could not be found.'));
  }

  if (event.isCancelled) {
    return res.status(409).send(rsvpActionHtml('Event cancelled', 'This event was cancelled, so RSVP updates are disabled.'));
  }

  if (payload.userId) {
    await prisma.eventRsvp.upsert({
      where: {
        tenantId_eventId_userId: {
          tenantId: payload.tenantId,
          eventId: payload.eventId,
          userId: payload.userId
        }
      },
      create: {
        tenantId: payload.tenantId,
        eventId: payload.eventId,
        userId: payload.userId,
        status: payload.status,
        source: payload.source,
        respondedAt: new Date()
      },
      update: {
        status: payload.status,
        source: payload.source,
        respondedAt: new Date()
      }
    });
  } else if (payload.capid) {
    const existing = await prisma.eventRsvp.findFirst({
      where: { tenantId: payload.tenantId, eventId: payload.eventId, capid: payload.capid },
      select: { id: true }
    });

    if (existing) {
      await prisma.eventRsvp.update({
        where: { id: existing.id },
        data: {
          status: payload.status,
          source: payload.source,
          respondedAt: new Date()
        }
      });
    } else {
      await prisma.eventRsvp.create({
        data: {
          tenantId: payload.tenantId,
          eventId: payload.eventId,
          capid: payload.capid,
          status: payload.status,
          source: payload.source,
          respondedAt: new Date()
        }
      });
    }
  } else {
    return res.status(400).send(rsvpActionHtml('Invalid RSVP link', 'This RSVP link is missing a recipient identity.'));
  }

  return res.status(200).send(rsvpActionHtml('RSVP recorded', `Your RSVP (${payload.status.toUpperCase()}) for "${event.title}" has been saved.`));
});

tenantRouter.use(requireAuth);

const queryBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return value;
}, z.boolean().optional());

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

const ensureTenantAdminAccess = async (tenantId: string, auth: { userId: string; systemRole: 'systemAdmin' | 'user' }) => {
  if (auth.systemRole === 'systemAdmin') {
    return;
  }

  const assignment = await prisma.tenantUser.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId: auth.userId
      }
    },
    select: { role: true }
  });

  if (assignment?.role !== 'tenantAdmin') {
    throw new Error('Tenant admin required');
  }
};

const recurrenceSchema = z
  .object({
    frequency: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
    interval: z.coerce.number().int().min(1).max(52).default(1),
    occurrences: z.coerce.number().int().min(1).max(365).optional(),
    until: z.coerce.date().optional()
  })
  .default({ frequency: 'none', interval: 1 });

const addMonthsSafe = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
};

const buildRecurringInstances = (args: {
  startsAt: Date;
  endsAt: Date;
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  interval: number;
  occurrences?: number;
  until?: Date;
}): Array<{ startsAt: Date; endsAt: Date; index: number }> => {
  const maxByRequest = args.occurrences ?? (args.frequency === 'none' ? 1 : 12);
  const maxOccurrences = Math.min(Math.max(maxByRequest, 1), 365);
  const durationMs = args.endsAt.getTime() - args.startsAt.getTime();

  const instances: Array<{ startsAt: Date; endsAt: Date; index: number }> = [];
  let cursor = new Date(args.startsAt.getTime());

  while (instances.length < maxOccurrences) {
    if (args.until && cursor > args.until) {
      break;
    }

    instances.push({ startsAt: new Date(cursor.getTime()), endsAt: new Date(cursor.getTime() + durationMs), index: instances.length });

    if (args.frequency === 'none') {
      break;
    }

    if (args.frequency === 'daily') {
      cursor = new Date(cursor.getTime() + args.interval * 24 * 60 * 60 * 1000);
    } else if (args.frequency === 'weekly') {
      cursor = new Date(cursor.getTime() + args.interval * 7 * 24 * 60 * 60 * 1000);
    } else {
      cursor = addMonthsSafe(cursor, args.interval);
    }
  }

  return instances;
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

  const [lastRun, memberCount, activeCount, nextEvent] = await Promise.all([
    scoped.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    scoped.member.count(),
    scoped.member.count({ where: { status: 'ACTIVE' } }),
    prisma.event.findFirst({
      where: {
        tenantId,
        isCancelled: false,
        endsAt: { gte: new Date() }
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        location: true,
        uniformOfDay: true
      }
    })
  ]);

  const nextRunAt = CronExpressionParser.parse(tenant.syncScheduleCron, {
    currentDate: new Date(),
    tz: tenant.timezone
  })
    .next()
    .toDate();

  res.json({ lastRun, memberCount, activeCount, nextRunAt, nextEvent });
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
      ready: queryBoolean,
      inactive: queryBoolean,
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
    ...(q.inactive === undefined ? {} : { inactive: q.inactive })
  };

  const [rawItems, allTenantRows] = await Promise.all([
    scoped.cadetPromotion.findMany({ where }),
    scoped.cadetPromotion.findMany({ where: { tenantId } })
  ]);

  const capids = [...new Set(rawItems.map((item: any) => item.capid).filter(Boolean))];
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

  const formatReadyDate = (value: Date | null): string | null => {
    if (!value) return null;
    const d = new Date(value);
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  };

  const decorate = (item: any) => {
    const member = membersByCapid.get(item.capid);
    const computed = computeCadetPromotion({
      ptDate: item.ptDate,
      leadershipTestDate: item.leadershipTestDate,
      leadershipModuleDate: item.leadershipModuleDate,
      aeTestDate: item.aeTestDate,
      aeModuleDate: item.aeModuleDate,
      drillDate: item.drillDate,
      moralForumDate: item.moralForumDate,
      welcomeCourseDate: item.welcomeCourseDate,
      staffServiceDate: item.staffServiceDate,
      oralPresentationDate: item.oralPresentationDate,
      requiresCD: item.requiresCD,
      requiresSDA: item.requiresSDA,
      isFirstAchievement: item.isFirstAchievement,
      leadershipTestNotRequired: item.leadershipTestNotRequired,
      leadershipModuleNotRequired: item.leadershipModuleNotRequired,
      aeTestNotRequired: item.aeTestNotRequired,
      aeModuleNotRequired: item.aeModuleNotRequired,
      drillNotRequired: item.drillNotRequired,
      today: new Date()
    });

    const resolvedReady = !item.inactive && computed.ready;
    const resolvedReadyStatus = item.readyStatus ?? (resolvedReady ? formatReadyDate(item.datePromotionEligible) ?? 'Yes' : null);

    return {
      ...item,
      memberName: item.memberName ?? (member ? `${member.lastName}, ${member.firstName}` : null),
      rank: item.rank ?? member?.grade ?? null,
      ptStatus: computed.ptStatus,
      leadStatus: computed.leadStatus,
      aeStatus: computed.aeStatus,
      drillStatus: computed.drillStatus,
      cdStatus: computed.cdStatus,
      sdaStatus: computed.sdaStatus,
      ready: resolvedReady,
      readyStatus: resolvedReadyStatus,
      missingKeys: computed.missingKeys,
      needs: computed.needs,
      explain: computed.explain
    };
  };

  const enrichedItems = rawItems.map(decorate);
  const enrichedAll = allTenantRows.map(decorate);

  const readyFiltered = q.ready === undefined ? enrichedItems : enrichedItems.filter((item: any) => item.ready === q.ready);

  const compareText = (a: string | null | undefined, b: string | null | undefined) =>
    (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });

  const compareDate = (a: Date | null | undefined, b: Date | null | undefined) => {
    const av = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
    const bv = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;
    return av - bv;
  };

  const sortFactor = q.sortDir === 'asc' ? 1 : -1;
  const sorted = [...readyFiltered].sort((a, b) => {
    let result = 0;
    switch (q.sortBy) {
      case 'memberName':
        result = compareText(a.memberName, b.memberName);
        break;
      case 'rank':
        result = compareText(a.rank, b.rank);
        break;
      case 'capid':
        result = compareText(a.capid, b.capid);
        break;
      case 'achievementName':
        result = compareText(a.achievementName, b.achievementName);
        break;
      case 'datePromotionEligible':
        result = compareDate(a.datePromotionEligible, b.datePromotionEligible);
        break;
      case 'lastPtDate':
        result = compareDate(a.lastPtDate, b.lastPtDate);
        break;
      case 'ready':
        result = Number(a.ready) - Number(b.ready);
        break;
      case 'inactive':
        result = Number(a.inactive) - Number(b.inactive);
        break;
      default:
        result = compareText(a.memberName, b.memberName);
    }

    if (result === 0) {
      result = compareText(a.capid, b.capid);
    }

    return result * sortFactor;
  });

  const total = sorted.length;
  const start = (q.page - 1) * q.pageSize;
  const pagedItems = sorted.slice(start, start + q.pageSize);

  const readyCount = enrichedAll.filter((item: any) => item.ready).length;
  const inactiveCount = enrichedAll.filter((item: any) => item.inactive).length;

  res.json({ items: pagedItems, total, page: q.page, pageSize: q.pageSize, summary: { readyCount, inactiveCount } });
});

tenantRouter.get('/:slug/events', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const q = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(25),
      q: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      includePast: queryBoolean.default(false),
      status: z.enum(['active', 'cancelled', 'all']).default('active'),
      memberType: z.enum(['CADET', 'SENIOR', 'UNKNOWN']).optional(),
      sortBy: z.enum(['startsAt', 'title', 'updatedAt', 'createdAt']).default('startsAt'),
      sortDir: z.enum(['asc', 'desc']).default('asc')
    })
    .parse(req.query);

  const where = {
    tenantId,
    ...(q.status === 'all' ? {} : { isCancelled: q.status === 'cancelled' }),
    ...(q.q
      ? {
          OR: [
            { title: { contains: q.q, mode: 'insensitive' as const } },
            { description: { contains: q.q, mode: 'insensitive' as const } },
            { location: { contains: q.q, mode: 'insensitive' as const } }
          ]
        }
      : {}),
    ...(q.from || q.to
      ? {
          startsAt: {
            ...(q.from ? { gte: q.from } : {}),
            ...(q.to ? { lte: q.to } : {})
          }
        }
      : {}),
    ...(!q.includePast
      ? {
          endsAt: {
            gte: new Date()
          }
        }
      : {}),
    ...(q.memberType
      ? {
          OR: [{ audienceRules: { none: {} } }, { audienceRules: { some: { memberType: q.memberType } } }]
        }
      : {})
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ [q.sortBy]: q.sortDir }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        audienceRules: true,
        rsvps: {
          select: { userId: true, status: true }
        }
      }
    }),
    prisma.event.count({ where })
  ]);

  const items = events.map((event: (typeof events)[number]) => {
    const yesCount = event.rsvps.filter((rsvp: { status: string }) => rsvp.status === 'yes').length;
    const noCount = event.rsvps.filter((rsvp: { status: string }) => rsvp.status === 'no').length;
    const maybeCount = event.rsvps.filter((rsvp: { status: string }) => rsvp.status === 'maybe').length;
    const myRsvp = event.rsvps.find((rsvp: { userId: string | null; status: string }) => rsvp.userId === req.auth!.userId)?.status ?? null;

    return {
      ...event,
      rsvps: undefined,
      counts: { yes: yesCount, no: noCount, maybe: maybeCount, total: event.rsvps.length },
      myRsvp
    };
  });

  res.json({ items, total, page: q.page, pageSize: q.pageSize });
});

tenantRouter.post('/:slug/events', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);

  const body = z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      location: z.string().optional(),
      uniformOfDay: z.enum(['PT', 'ABU_OCP', 'BLUES']).optional(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
      allDay: z.boolean().default(false),
      visibility: z.enum(['tenant', 'audience']).default('tenant'),
      recurrence: recurrenceSchema,
      audienceRules: z
        .array(
          z.object({
            memberType: z.enum(['CADET', 'SENIOR', 'UNKNOWN']).optional(),
            unitCharter: z.string().optional()
          })
        )
        .default([])
    })
    .parse(req.body);

  if (body.endsAt < body.startsAt) {
    throw new Error('Event end must be after start');
  }

  if (body.recurrence.until && body.recurrence.until < body.startsAt) {
    throw new Error('Recurrence end must be after first event start');
  }

  const normalizedRules = body.visibility === 'tenant' ? [] : body.audienceRules;
  const frequency = body.recurrence.frequency;
  const interval = body.recurrence.interval;
  const instances = buildRecurringInstances({
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    frequency,
    interval,
    occurrences: body.recurrence.occurrences,
    until: body.recurrence.until
  });
  const recurrenceSeriesId = instances.length > 1 ? randomUUID() : null;

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdEvents: Array<{ id: string }> = [];
    for (const instance of instances) {
      const event = await tx.event.create({
        data: {
          tenantId,
          title: body.title,
          description: body.description,
          location: body.location,
          uniformOfDay: body.uniformOfDay ?? null,
          startsAt: instance.startsAt,
          endsAt: instance.endsAt,
          allDay: body.allDay,
          visibility: body.visibility,
          createdByUserId: req.auth!.userId,
          recurrenceSeriesId,
          recurrenceFrequency: frequency,
          recurrenceInterval: interval,
          recurrenceUntil: body.recurrence.until ?? null,
          audienceRules: {
            create: normalizedRules.map((rule) => ({
              tenantId,
              memberType: rule.memberType,
              unitCharter: rule.unitCharter
            }))
          }
        },
        select: { id: true }
      });
      createdEvents.push(event);
    }

    return tx.event.findFirst({
      where: { id: createdEvents[0].id },
      include: { audienceRules: true }
    });
  });

  res.status(201).json({ created, createdCount: instances.length });
});

tenantRouter.get('/:slug/events/:eventId', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const eventId = z.string().min(1).parse(req.params.eventId);

  const event = await prisma.event.findFirst({
    where: { tenantId, id: eventId },
    include: {
      audienceRules: true,
      rsvps: {
        orderBy: { respondedAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true }
          }
        }
      }
    }
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const yesCount = event.rsvps.filter((rsvp: { status: string }) => rsvp.status === 'yes').length;
  const noCount = event.rsvps.filter((rsvp: { status: string }) => rsvp.status === 'no').length;
  const maybeCount = event.rsvps.filter((rsvp: { status: string }) => rsvp.status === 'maybe').length;
  const myRsvp = event.rsvps.find((rsvp: { userId: string | null; status: string }) => rsvp.userId === req.auth!.userId)?.status ?? null;
  const capids = [...new Set(event.rsvps.map((rsvp: { capid: string | null }) => rsvp.capid).filter((capid: string | null): capid is string => Boolean(capid)))];

  const membersByCapid = new Map<string, string>();
  if (capids.length > 0) {
    const members = await prisma.member.findMany({
      where: {
        tenantId,
        capid: { in: capids }
      },
      select: {
        capid: true,
        firstName: true,
        lastName: true
      }
    });

    for (const member of members) {
      membersByCapid.set(member.capid, `${member.firstName} ${member.lastName}`.trim());
    }
  }

  const rsvps = event.rsvps.map((rsvp: (typeof event.rsvps)[number]) => ({
    ...rsvp,
    memberName: rsvp.capid ? membersByCapid.get(rsvp.capid) ?? null : null
  }));

  res.json({
    ...event,
    rsvps,
    counts: { yes: yesCount, no: noCount, maybe: maybeCount, total: event.rsvps.length },
    myRsvp
  });
});

tenantRouter.patch('/:slug/events/:eventId', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);
  const eventId = z.string().min(1).parse(req.params.eventId);

  const body = z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      uniformOfDay: z.enum(['PT', 'ABU_OCP', 'BLUES']).nullable().optional(),
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
      allDay: z.boolean().optional(),
      visibility: z.enum(['tenant', 'audience']).optional(),
      recurrence: recurrenceSchema.optional(),
      isCancelled: z.boolean().optional(),
      cancelReason: z.string().nullable().optional(),
      audienceRules: z
        .array(
          z.object({
            memberType: z.enum(['CADET', 'SENIOR', 'UNKNOWN']).optional(),
            unitCharter: z.string().optional()
          })
        )
        .optional()
    })
    .parse(req.body);

  const existing = await prisma.event.findFirst({ where: { tenantId, id: eventId } });
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const startsAt = body.startsAt ?? existing.startsAt;
  const endsAt = body.endsAt ?? existing.endsAt;
  if (endsAt < startsAt) {
    throw new Error('Event end must be after start');
  }

  if (body.recurrence?.until && body.recurrence.until < startsAt) {
    throw new Error('Recurrence end must be after event start');
  }

  const visibility = body.visibility ?? existing.visibility;

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (body.audienceRules || visibility === 'tenant') {
      await tx.eventAudienceRule.deleteMany({ where: { tenantId, eventId } });
      const nextRules = visibility === 'tenant' ? [] : (body.audienceRules ?? []);
      if (nextRules.length > 0) {
        await tx.eventAudienceRule.createMany({
          data: nextRules.map((rule) => ({
            tenantId,
            eventId,
            memberType: rule.memberType,
            unitCharter: rule.unitCharter
          }))
        });
      }
    }

    return tx.event.update({
      where: { id: eventId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.location !== undefined ? { location: body.location } : {}),
        ...(body.uniformOfDay !== undefined ? { uniformOfDay: body.uniformOfDay } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt } : {}),
        ...(body.endsAt !== undefined ? { endsAt: body.endsAt } : {}),
        ...(body.allDay !== undefined ? { allDay: body.allDay } : {}),
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.recurrence !== undefined
          ? {
              recurrenceFrequency: body.recurrence.frequency,
              recurrenceInterval: body.recurrence.interval,
              recurrenceUntil: body.recurrence.until ?? null
            }
          : {}),
        ...(body.isCancelled !== undefined ? { isCancelled: body.isCancelled } : {}),
        ...(body.cancelReason !== undefined ? { cancelReason: body.cancelReason } : {}),
        updatedByUserId: req.auth!.userId
      },
      include: { audienceRules: true }
    });
  });

  res.json(updated);
});

tenantRouter.delete('/:slug/events/:eventId', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);
  const eventId = z.string().min(1).parse(req.params.eventId);

  const existing = await prisma.event.findFirst({ where: { tenantId, id: eventId }, select: { id: true } });
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      isCancelled: true,
      updatedByUserId: req.auth!.userId
    }
  });

  res.status(204).send();
});

tenantRouter.get('/:slug/events/:eventId/rsvps', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const eventId = z.string().min(1).parse(req.params.eventId);

  const event = await prisma.event.findFirst({ where: { tenantId, id: eventId }, select: { id: true } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const q = z
    .object({
      status: z.enum(['yes', 'no', 'maybe']).optional()
    })
    .parse(req.query);

  const rsvps = await prisma.eventRsvp.findMany({
    where: {
      tenantId,
      eventId,
      ...(q.status ? { status: q.status } : {})
    },
    orderBy: { respondedAt: 'desc' },
    include: {
      user: {
        select: { id: true, email: true }
      }
    }
  });

  const capids = [...new Set(rsvps.map((rsvp: (typeof rsvps)[number]) => rsvp.capid).filter((capid: string | null): capid is string => Boolean(capid)))];
  const membersByCapid = new Map<string, string>();
  if (capids.length > 0) {
    const members = await prisma.member.findMany({
      where: {
        tenantId,
        capid: { in: capids }
      },
      select: {
        capid: true,
        firstName: true,
        lastName: true
      }
    });

    for (const member of members) {
      membersByCapid.set(member.capid, `${member.firstName} ${member.lastName}`.trim());
    }
  }

  res.json(
    rsvps.map((rsvp: (typeof rsvps)[number]) => ({
      ...rsvp,
      memberName: rsvp.capid ? membersByCapid.get(rsvp.capid) ?? null : null
    }))
  );
});

tenantRouter.put('/:slug/events/:eventId/rsvp', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const eventId = z.string().min(1).parse(req.params.eventId);
  const body = z
    .object({
      status: z.enum(['yes', 'no', 'maybe']),
      note: z.string().max(500).optional()
    })
    .parse(req.body);

  const event = await prisma.event.findFirst({ where: { tenantId, id: eventId }, select: { id: true, isCancelled: true } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.isCancelled) {
    throw new Error('Cannot RSVP to cancelled event');
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: {
      tenantId_eventId_userId: {
        tenantId,
        eventId,
        userId: req.auth!.userId
      }
    },
    create: {
      tenantId,
      eventId,
      userId: req.auth!.userId,
      status: body.status,
      note: body.note,
      source: 'web',
      respondedAt: new Date()
    },
    update: {
      status: body.status,
      note: body.note,
      source: 'web',
      respondedAt: new Date()
    }
  });

  res.json(rsvp);
});

tenantRouter.post('/:slug/events/:eventId/notify', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);
  const eventId = z.string().min(1).parse(req.params.eventId);

  const body = z
    .object({
      type: z.enum(['publish', 'update', 'reminder']).default('reminder'),
      channels: z.array(z.enum(['email', 'push'])).min(1),
      scheduledAt: z.coerce.date().optional()
    })
    .parse(req.body);

  const event = await prisma.event.findFirst({ where: { tenantId, id: eventId }, select: { id: true } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const channels = [...new Set(body.channels)];
  const scheduledAt = body.scheduledAt ?? new Date();

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = [] as Array<{ id: string; channel: 'email' | 'push'; status: 'queued'; scheduledAt: Date }>;
    for (const channel of channels) {
      const row = await tx.eventNotification.create({
        data: {
          tenantId,
          eventId,
          channel,
          type: body.type,
          scheduledAt,
          status: 'queued',
          payloadJson: {
            requestedByUserId: req.auth!.userId,
            requestedAt: new Date().toISOString()
          }
        },
        select: {
          id: true,
          channel: true,
          status: true,
          scheduledAt: true
        }
      });
      rows.push(row as { id: string; channel: 'email' | 'push'; status: 'queued'; scheduledAt: Date });
    }
    return rows;
  });

  if (scheduledAt.getTime() <= Date.now()) {
    await Promise.all(
      created.map((row: (typeof created)[number]) =>
        notificationQueue.add('dispatch-notification', { notificationId: row.id }, { jobId: `event-notification-${row.id}`, removeOnComplete: 50, removeOnFail: 200 })
      )
    );
  }

  res.status(201).json({ items: created });
});

tenantRouter.post('/:slug/notifications/push-subscriptions', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);

  const body = z
    .object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1)
      }),
      expiresAt: z.coerce.date().nullable().optional()
    })
    .parse(req.body);

  const subscription = await prisma.pushSubscription.upsert({
    where: {
      tenantId_userId_endpoint: {
        tenantId,
        userId: req.auth!.userId,
        endpoint: body.endpoint
      }
    },
    create: {
      tenantId,
      userId: req.auth!.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      expiresAt: body.expiresAt ?? null,
      lastSeenAt: new Date()
    },
    update: {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      expiresAt: body.expiresAt ?? null,
      lastSeenAt: new Date()
    }
  });

  res.status(201).json({ id: subscription.id, endpoint: subscription.endpoint });
});

tenantRouter.delete('/:slug/notifications/push-subscriptions', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  const body = z
    .object({
      endpoint: z.string().url()
    })
    .parse(req.body);

  await prisma.pushSubscription.deleteMany({
    where: {
      tenantId,
      userId: req.auth!.userId,
      endpoint: body.endpoint
    }
  });

  res.status(204).send();
});

tenantRouter.get('/:slug/notification-logs', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);

  const q = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(25)
    })
    .parse(req.query);

  const [eventItems, testEmailItems, eventTotal, testTotal] = await Promise.all([
    prisma.eventNotification.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 250,
      select: {
        id: true,
        channel: true,
        type: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true
          }
        }
      }
    }),
    prisma.testEmailLog.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 250,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        status: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true
      }
    }),
    prisma.eventNotification.count({ where: { tenantId } }),
    prisma.testEmailLog.count({ where: { tenantId } })
  ]);

  const combined = [
    ...eventItems.map((item: (typeof eventItems)[number]) => ({
      id: item.id,
      kind: 'event' as const,
      channel: item.channel,
      type: item.type,
      status: item.status,
      scheduledAt: item.scheduledAt,
      sentAt: item.sentAt,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      recipient: null,
      subject: null,
      event: item.event
    })),
    ...testEmailItems.map((item: (typeof testEmailItems)[number]) => ({
      id: item.id,
      kind: 'test-email' as const,
      channel: 'email' as const,
      type: 'reminder' as const,
      status: item.status,
      scheduledAt: item.createdAt,
      sentAt: item.sentAt,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      recipient: item.toEmail,
      subject: item.subject,
      event: null
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const start = (q.page - 1) * q.pageSize;
  const paged = combined.slice(start, start + q.pageSize);

  res.json({ items: paged, total: eventTotal + testTotal, page: q.page, pageSize: q.pageSize });
});

tenantRouter.post('/:slug/settings/test-email', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);

  const body = z
    .object({
      to: z.string().email(),
      subject: z.string().max(200).optional(),
      message: z.string().max(2000).optional()
    })
    .parse(req.body);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  const subject = body.subject?.trim() || `[SquadronForge] Test email for ${tenant.name}`;
  const message =
    body.message?.trim() ||
    `This is a SquadronForge notification test email for tenant "${tenant.name}" (${tenant.slug}). If you received this, SMTP delivery is working.`;

  const testLog = await prisma.testEmailLog.create({
    data: {
      tenantId,
      toEmail: body.to,
      subject,
      status: 'queued',
      requestedByUserId: req.auth!.userId
    },
    select: { id: true }
  });

  const job = await notificationQueue.add(
    'send-test-email',
    {
      logId: testLog.id,
      tenantId,
      to: body.to,
      subject,
      message,
      requestedByUserId: req.auth!.userId,
      requestedAt: new Date().toISOString()
    },
    { removeOnComplete: 50, removeOnFail: 200 }
  );

  await prisma.testEmailLog.update({
    where: { id: testLog.id },
    data: { jobId: String(job.id ?? '') }
  });

  res.status(202).json({ enqueued: true, jobId: job.id, logId: testLog.id });
});

tenantRouter.post('/:slug/settings/test-event-rsvp', async (req, res) => {
  const tenantId = await ensureTenantAccess(req.auth!.userId, req.params.slug);
  await ensureTenantAdminAccess(tenantId, req.auth!);

  const body = z
    .object({
      eventId: z.string().min(1),
      to: z.string().email()
    })
    .parse(req.body);

  const [tenant, event] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } }),
    prisma.event.findFirst({
      where: { id: body.eventId, tenantId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        location: true,
        isCancelled: true
      }
    })
  ]);

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (event.isCancelled) {
    return res.status(409).json({ error: 'Cannot send test RSVP for a cancelled event' });
  }

  const subject = `[SquadronForge] Test RSVP links for ${event.title}`;
  const testLog = await prisma.testEmailLog.create({
    data: {
      tenantId,
      toEmail: body.to,
      subject,
      status: 'queued',
      requestedByUserId: req.auth!.userId
    },
    select: { id: true }
  });

  const job = await notificationQueue.add(
    'send-test-event-rsvp',
    {
      logId: testLog.id,
      tenantId,
      eventId: event.id,
      to: body.to,
      requestedByUserId: req.auth!.userId,
      requestedAt: new Date().toISOString()
    },
    { removeOnComplete: 50, removeOnFail: 200 }
  );

  await prisma.testEmailLog.update({
    where: { id: testLog.id },
    data: { jobId: String(job.id ?? '') }
  });

  res.status(202).json({ enqueued: true, jobId: job.id, logId: testLog.id, event: { id: event.id, title: event.title } });
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
