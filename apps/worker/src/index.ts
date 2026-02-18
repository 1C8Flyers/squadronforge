import 'dotenv/config';
import fsSync from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Queue, Worker } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { Prisma, PrismaClient } from '@prisma/client';
import unzipper from 'unzipper';

const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const queue = new Queue('capwatch-sync', { connection });

type ParsedMember = {
  capid: string;
  firstName: string;
  lastName: string;
  memberType: 'CADET' | 'SENIOR' | 'UNKNOWN';
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  email?: string;
  unitCharter?: string;
  orgid?: number;
  expirationDate?: Date;
};

type ParsedDutyPosition = {
  capid: string;
  dutyName: string;
  dutyCode?: string;
  startDate?: Date;
  endDate?: Date;
};

type ParsedMemberContact = {
  capid: string;
  type: string;
  priority?: string;
  contact: string;
  doNotContact: boolean;
  contactName?: string;
};

type ParsedMemberAddress = {
  capid: string;
  type: string;
  priority?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: string;
  longitude?: string;
};

const advisoryKeyFromTenantId = (tenantId: string): number => {
  let hash = 0;
  for (let i = 0; i < tenantId.length; i += 1) {
    hash = (hash * 31 + tenantId.charCodeAt(i)) | 0;
  }
  return hash;
};

const getCredential = (credentialsRef: string, key: 'CAPID' | 'PASSWORD'): string => {
  const envKey = `CAPWATCH_${credentialsRef.toUpperCase()}_${key}`;
  const value = process.env[envKey];
  if (value) {
    return value;
  }

  const envFileKey = `${envKey}_FILE`;
  const filePath = process.env[envFileKey];
  if (filePath) {
    return fsSync.readFileSync(filePath, 'utf8').trim();
  }

  throw new Error(`Missing CAPWATCH credential: ${envKey} or ${envFileKey}`);
};

const downloadZip = async (orgid: number, unitOnly: boolean, credentialsRef: string): Promise<{ zipPath: string; tempDir: string; checksum: string; size: number }> => {
  const capid = getCredential(credentialsRef, 'CAPID');
  const password = getCredential(credentialsRef, 'PASSWORD');
  const auth = Buffer.from(`${capid}:${password}`).toString('base64');
  const url = `https://www.capnhq.gov/CAP.CapWatchAPI.Web/api/cw?ORGID=${orgid}&unitOnly=${unitOnly ? 1 : 0}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`CAPWATCH download failed with status ${response.status}`);
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('zip') && !contentType.includes('octet-stream')) {
    throw new Error(`Unexpected CAPWATCH content-type: ${contentType || 'unknown'}`);
  }

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'capwatch-'));
  const zipPath = path.join(tempDir, 'capwatch.zip');
  const writeStream = fsSync.createWriteStream(zipPath);
  const hash = crypto.createHash('sha256');
  let size = 0;

  const nodeStream = Readable.fromWeb(response.body as any);
  nodeStream.on('data', (chunk: Buffer) => {
    size += chunk.length;
    hash.update(chunk);
  });

  await pipeline(nodeStream, writeStream);

  if (size <= 0) {
    throw new Error('CAPWATCH ZIP download was empty');
  }

  return { zipPath, tempDir, checksum: hash.digest('hex'), size };
};

const extractZip = async (zipPath: string): Promise<string> => {
  const outputDir = path.join(path.dirname(zipPath), 'unzipped');
  await fsPromises.mkdir(outputDir, { recursive: true });
  await fsSync.createReadStream(zipPath).pipe(unzipper.Extract({ path: outputDir })).promise();
  return outputDir;
};

const listFilesRecursive = async (folder: string): Promise<string[]> => {
  const entries = await fsPromises.readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(full);
      }
      return [full];
    })
  );
  return nested.flat();
};

const detectDelimiter = (header: string): string => {
  const candidates = ['|', ',', '\t'];
  const score = candidates.map((d) => ({ d, count: header.split(d).length }));
  return score.sort((a, b) => b.count - a.count)[0]?.d ?? '|';
};

const detectFileByHeader = async (files: string[], requiredColumns: string[]): Promise<string | undefined> => {
  for (const file of files) {
    const text = await fsPromises.readFile(file, 'utf8');
    const first = text.split(/\r?\n/)[0]?.toLowerCase() ?? '';
    const foundAll = requiredColumns.every((column) => first.includes(column));
    if (foundAll) {
      return file;
    }
  }
  return undefined;
};

const detectMembershipFileByHeader = async (files: string[]): Promise<string | undefined> => {
  for (const file of files) {
    const text = await fsPromises.readFile(file, 'utf8');
    const first = text.split(/\r?\n/)[0]?.toLowerCase() ?? '';
    const hasCapid = first.includes('capid');
    const hasLast = first.includes('lastname') || first.includes('namelast');
    const hasFirst = first.includes('firstname') || first.includes('namefirst');
    if (hasCapid && hasLast && hasFirst) {
      return file;
    }
  }
  return undefined;
};

const detectDutyFileByHeader = async (files: string[]): Promise<string | undefined> => {
  for (const file of files) {
    const text = await fsPromises.readFile(file, 'utf8');
    const first = text.split(/\r?\n/)[0]?.toLowerCase() ?? '';
    const hasCapid = first.includes('capid');
    const hasDuty = first.includes('dutyname') || first.includes('duty');
    if (hasCapid && hasDuty) {
      return file;
    }
  }
  return undefined;
};

const discoverCapwatchFiles = async (
  extractedDir: string,
  mapping: Record<string, string> | undefined
): Promise<{ organization?: string; membership?: string; dutyPosition?: string; memberContact?: string; memberAddress?: string; files: string[] }> => {
  const files = await listFilesRecursive(extractedDir);
  const relativeFiles = files.map((f) => path.relative(extractedDir, f));
  const lowerMap = new Map(relativeFiles.map((rf, idx) => [rf.toLowerCase(), files[idx]]));

  const organization = lowerMap.get('organization.txt');
  const mappedMembership = mapping?.membership ? lowerMap.get(mapping.membership.toLowerCase()) : undefined;
  const mappedDuty = mapping?.dutyPosition ? lowerMap.get(mapping.dutyPosition.toLowerCase()) : undefined;
  const mappedMemberContact = mapping?.memberContact ? lowerMap.get(mapping.memberContact.toLowerCase()) : undefined;
  const mappedMemberAddress = mapping?.memberAddress ? lowerMap.get(mapping.memberAddress.toLowerCase()) : undefined;

  const preferredMembership = lowerMap.get('member.txt') ?? lowerMap.get('membership.txt');
  const preferredDuty = lowerMap.get('dutyposition.txt') ?? lowerMap.get('cadetdutypositions.txt');
  const preferredMemberContact = lowerMap.get('mbrcontact.txt');
  const preferredMemberAddress = lowerMap.get('mbraddresses.txt');

  const membershipByHeuristic = files.find((fullPath) => {
    const name = path.basename(fullPath).toLowerCase();
    return /^member(\b|[_.-])/.test(name) || name === 'member.txt' || name.includes('membership');
  });

  const dutyByHeuristic = files.find((fullPath) => {
    const name = path.basename(fullPath).toLowerCase();
    return name.includes('dutyposition') || /^duty(\b|[_.-])/.test(name);
  });

  const memberContactByHeuristic = files.find((fullPath) => {
    const name = path.basename(fullPath).toLowerCase();
    return name.includes('mbrcontact') || (name.includes('contact') && name.includes('mbr'));
  });

  const memberAddressByHeuristic = files.find((fullPath) => {
    const name = path.basename(fullPath).toLowerCase();
    return name.includes('mbraddress') || (name.includes('address') && name.includes('mbr'));
  });

  const membership = mappedMembership ?? preferredMembership ?? membershipByHeuristic ?? (await detectMembershipFileByHeader(files));
  const dutyPosition = mappedDuty ?? preferredDuty ?? dutyByHeuristic ?? (await detectDutyFileByHeader(files));
  const memberContact = mappedMemberContact ?? preferredMemberContact ?? memberContactByHeuristic;
  const memberAddress = mappedMemberAddress ?? preferredMemberAddress ?? memberAddressByHeuristic;

  return { organization, membership, dutyPosition, memberContact, memberAddress, files: relativeFiles };
};

const normalizeMemberType = (value: string): ParsedMember['memberType'] => {
  const v = value.toUpperCase();
  if (v.includes('CADET')) return 'CADET';
  if (v.includes('SENIOR')) return 'SENIOR';
  return 'UNKNOWN';
};

const normalizeStatus = (value: string): ParsedMember['status'] => {
  const v = value.toUpperCase();
  if (v.includes('INACTIVE')) return 'INACTIVE';
  if (v.includes('ACTIVE')) return 'ACTIVE';
  return 'UNKNOWN';
};

const parseDateSafe = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

const normalizeCell = (value: string | undefined): string => {
  const trimmed = (value ?? '').trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"').trim();
  }
  return trimmed;
};

const parseMembershipFile = async (membershipFile: string): Promise<ParsedMember[]> => {
  const raw = await fsPromises.readFile(membershipFile, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((c) => c.trim().toLowerCase());
  const indexOfAny = (...names: string[]): number => header.findIndex((h) => names.includes(h));

  const idx = {
    capid: indexOfAny('capid'),
    firstName: indexOfAny('firstname', 'namefirst'),
    lastName: indexOfAny('lastname', 'namelast'),
    memberType: indexOfAny('membertype', 'type'),
    status: indexOfAny('status', 'mbrstatus'),
    email: indexOfAny('email'),
    unitCharter: indexOfAny('unitcharter', 'unit'),
    orgid: indexOfAny('orgid'),
    expirationDate: indexOfAny('expirationdate', 'expiration')
  };

  if (idx.capid < 0 || idx.lastName < 0 || idx.firstName < 0) {
    throw new Error('Membership file missing required columns');
  }

  const members = lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((v) => normalizeCell(v));
    return {
      capid: cols[idx.capid] ?? '',
      firstName: cols[idx.firstName] ?? '',
      lastName: cols[idx.lastName] ?? '',
      memberType: normalizeMemberType(cols[idx.memberType] ?? ''),
      status: normalizeStatus(cols[idx.status] ?? ''),
      email: cols[idx.email] || undefined,
      unitCharter: cols[idx.unitCharter] || undefined,
      orgid: Number(cols[idx.orgid]) || undefined,
      expirationDate: parseDateSafe(cols[idx.expirationDate])
    } satisfies ParsedMember;
  });

  return members.filter((m) => m.capid.length > 0);
};

const parseDutyPositionFile = async (dutyFile: string): Promise<ParsedDutyPosition[]> => {
  const raw = await fsPromises.readFile(dutyFile, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const indexOfAny = (...names: string[]): number => header.findIndex((h) => names.includes(h));

  const idx = {
    capid: indexOfAny('capid'),
    dutyName: indexOfAny('dutyname', 'duty'),
    dutyCode: indexOfAny('dutycode', 'functarea'),
    startDate: indexOfAny('startdate', 'datemod'),
    endDate: indexOfAny('enddate')
  };

  if (idx.capid < 0 || idx.dutyName < 0) {
    throw new Error('Duty position file missing required columns');
  }

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((v) => normalizeCell(v));
    return {
      capid: cols[idx.capid] ?? '',
      dutyName: cols[idx.dutyName] ?? '',
      dutyCode: cols[idx.dutyCode] || undefined,
      startDate: parseDateSafe(cols[idx.startDate]),
      endDate: parseDateSafe(cols[idx.endDate])
    } satisfies ParsedDutyPosition;
  });

  return rows.filter((r) => r.capid.length > 0 && r.dutyName.length > 0);
};

const parseMemberContactFile = async (contactFile: string): Promise<ParsedMemberContact[]> => {
  const raw = await fsPromises.readFile(contactFile, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const indexOfAny = (...names: string[]): number => header.findIndex((h) => names.includes(h));

  const idx = {
    capid: indexOfAny('capid'),
    type: indexOfAny('type'),
    priority: indexOfAny('priority'),
    contact: indexOfAny('contact'),
    doNotContact: indexOfAny('donotcontact'),
    contactName: indexOfAny('contactname')
  };

  if (idx.capid < 0 || idx.type < 0 || idx.contact < 0) {
    return [];
  }

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((v) => normalizeCell(v));
    return {
      capid: cols[idx.capid] ?? '',
      type: cols[idx.type] ?? '',
      priority: idx.priority >= 0 ? cols[idx.priority] || undefined : undefined,
      contact: cols[idx.contact] ?? '',
      doNotContact: (idx.doNotContact >= 0 ? cols[idx.doNotContact] : '').toLowerCase() === 'true',
      contactName: idx.contactName >= 0 ? cols[idx.contactName] || undefined : undefined
    } satisfies ParsedMemberContact;
  });

  return rows.filter((r) => r.capid.length > 0 && r.type.length > 0 && r.contact.length > 0);
};

const parseMemberAddressFile = async (addressFile: string): Promise<ParsedMemberAddress[]> => {
  const raw = await fsPromises.readFile(addressFile, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const indexOfAny = (...names: string[]): number => header.findIndex((h) => names.includes(h));

  const idx = {
    capid: indexOfAny('capid'),
    type: indexOfAny('type'),
    priority: indexOfAny('priority'),
    addr1: indexOfAny('addr1'),
    addr2: indexOfAny('addr2'),
    city: indexOfAny('city'),
    state: indexOfAny('state'),
    zip: indexOfAny('zip'),
    latitude: indexOfAny('latitude'),
    longitude: indexOfAny('longitude')
  };

  if (idx.capid < 0 || idx.type < 0) {
    return [];
  }

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((v) => normalizeCell(v));
    return {
      capid: cols[idx.capid] ?? '',
      type: cols[idx.type] ?? '',
      priority: idx.priority >= 0 ? cols[idx.priority] || undefined : undefined,
      addr1: idx.addr1 >= 0 ? cols[idx.addr1] || undefined : undefined,
      addr2: idx.addr2 >= 0 ? cols[idx.addr2] || undefined : undefined,
      city: idx.city >= 0 ? cols[idx.city] || undefined : undefined,
      state: idx.state >= 0 ? cols[idx.state] || undefined : undefined,
      zip: idx.zip >= 0 ? cols[idx.zip] || undefined : undefined,
      latitude: idx.latitude >= 0 ? cols[idx.latitude] || undefined : undefined,
      longitude: idx.longitude >= 0 ? cols[idx.longitude] || undefined : undefined
    } satisfies ParsedMemberAddress;
  });

  return rows.filter((r) => r.capid.length > 0 && r.type.length > 0);
};

const setRunStage = async (runId: string, stage: string) => {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      fileListJson: {
        stage
      }
    }
  });
};

const scheduleLoop = async () => {
  const tenants = await prisma.tenant.findMany({ where: { isEnabled: true } });
  const now = new Date();

  for (const tenant of tenants) {
    const interval = CronExpressionParser.parse(tenant.syncScheduleCron, {
      currentDate: now,
      tz: tenant.timezone
    });
    const previous = interval.prev().toDate();

    const shouldRun = Math.abs(now.getTime() - previous.getTime()) < 60_000;
    if (shouldRun) {
      await queue.add('sync-tenant', { tenantId: tenant.id }, { jobId: `tenant-${tenant.id}-${previous.toISOString()}` });
    }
  }
};

scheduleLoop().catch((error) => {
  console.error(JSON.stringify({ level: 'error', msg: 'initial_schedule_failed', error: String(error) }));
});

setInterval(() => {
  scheduleLoop().catch((error) => {
    console.error(JSON.stringify({ level: 'error', msg: 'schedule_loop_failed', error: String(error) }));
  });
}, 60_000);

new Worker(
  'capwatch-sync',
  async (job) => {
    const tenantId = job.data.tenantId as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const lockKey = advisoryKeyFromTenantId(tenantId);
    const lockResult = await prisma.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(${lockKey}) AS locked`;
    if (!lockResult[0]?.locked) {
      console.log(JSON.stringify({ level: 'info', msg: 'sync_skipped_running', tenantId }));
      return;
    }

    const run = await prisma.syncRun.create({
      data: {
        tenantId,
        startedAt: new Date(),
        status: 'running',
        fileListJson: {
          stage: 'queued'
        }
      }
    });
    let tempDir: string | undefined;

    try {
      await setRunStage(run.id, 'downloading');
      const download = await downloadZip(tenant.orgid, tenant.unitOnly, tenant.credentialsRef);
      tempDir = download.tempDir;

      await setRunStage(run.id, 'extracting');
      const extracted = await extractZip(download.zipPath);
      const mapping = (tenant.fileMappingJson ?? undefined) as Record<string, string> | undefined;

      await setRunStage(run.id, 'parsing');
      const discovery = await discoverCapwatchFiles(extracted, mapping);

      if (!discovery.membership) {
        throw new Error('Membership file not found in CAPWATCH ZIP');
      }

      const members = await parseMembershipFile(discovery.membership);
      const dutyPositions = discovery.dutyPosition ? await parseDutyPositionFile(discovery.dutyPosition) : [];
      const memberContacts = discovery.memberContact ? await parseMemberContactFile(discovery.memberContact) : [];
      const memberAddresses = discovery.memberAddress ? await parseMemberAddressFile(discovery.memberAddress) : [];
      let upsertCount = 0;
      let activeCount = 0;
      let dutyUpserted = 0;
      let memberContactsImported = 0;
      let memberAddressesImported = 0;

      await setRunStage(run.id, 'importing');

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const member of members) {
          await tx.member.upsert({
            where: { tenantId_capid: { tenantId, capid: member.capid } },
            update: {
              firstName: member.firstName,
              lastName: member.lastName,
              memberType: member.memberType,
              email: member.email,
              status: member.status,
              unitCharter: member.unitCharter,
              orgid: member.orgid,
              expirationDate: member.expirationDate
            },
            create: {
              tenantId,
              capid: member.capid,
              firstName: member.firstName,
              lastName: member.lastName,
              memberType: member.memberType,
              email: member.email,
              status: member.status,
              unitCharter: member.unitCharter,
              orgid: member.orgid,
              expirationDate: member.expirationDate
            }
          });
          upsertCount += 1;
          if (member.status === 'ACTIVE') {
            activeCount += 1;
          }
        }

        if (dutyPositions.length > 0) {
          await tx.dutyPosition.deleteMany({ where: { tenantId } });
          await tx.dutyPosition.createMany({
            data: dutyPositions.map((duty) => ({
              tenantId,
              capid: duty.capid,
              dutyName: duty.dutyName,
              dutyCode: duty.dutyCode,
              startDate: duty.startDate,
              endDate: duty.endDate
            }))
          });
          dutyUpserted = dutyPositions.length;
        }

        await tx.memberContact.deleteMany({ where: { tenantId } });
        if (memberContacts.length > 0) {
          await tx.memberContact.createMany({
            data: memberContacts.map((contact) => ({
              tenantId,
              capid: contact.capid,
              type: contact.type,
              priority: contact.priority,
              contact: contact.contact,
              doNotContact: contact.doNotContact,
              contactName: contact.contactName
            }))
          });
        }
        memberContactsImported = memberContacts.length;

        await tx.memberAddress.deleteMany({ where: { tenantId } });
        if (memberAddresses.length > 0) {
          await tx.memberAddress.createMany({
            data: memberAddresses.map((address) => ({
              tenantId,
              capid: address.capid,
              type: address.type,
              priority: address.priority,
              addr1: address.addr1,
              addr2: address.addr2,
              city: address.city,
              state: address.state,
              zip: address.zip,
              latitude: address.latitude,
              longitude: address.longitude
            }))
          });
        }
        memberAddressesImported = memberAddresses.length;
      });
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: 'success',
          membersActive: activeCount,
          membersUpserted: upsertCount,
          fileListJson: {
            stage: 'success',
            files: discovery.files,
            organizationFile: discovery.organization ? path.relative(extracted, discovery.organization) : null,
            membershipFile: path.relative(extracted, discovery.membership),
            dutyPositionFile: discovery.dutyPosition ? path.relative(extracted, discovery.dutyPosition) : null,
            memberContactFile: discovery.memberContact ? path.relative(extracted, discovery.memberContact) : null,
            memberAddressFile: discovery.memberAddress ? path.relative(extracted, discovery.memberAddress) : null,
            dutyPositionsUpserted: dutyUpserted,
            memberContactsImported,
            memberAddressesImported,
            downloadSizeBytes: download.size
          },
          checksum: download.checksum
        }
      });
    } catch (error) {
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: 'failed',
          fileListJson: {
            stage: 'failed'
          },
          errorMessage: error instanceof Error ? error.message : 'unknown error'
        }
      });
      throw error;
    } finally {
      if (tempDir) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
    }
  },
  { connection }
);

console.log(JSON.stringify({ level: 'info', msg: 'worker_started' }));
