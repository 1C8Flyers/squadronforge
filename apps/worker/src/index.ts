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
import nodemailer from 'nodemailer';
import webpush from 'web-push';

const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const queue = new Queue('capwatch-sync', { connection });
const notificationQueue = new Queue('event-notifications', { connection });

const RSVP_LINK_SECRET = process.env.RSVP_LINK_SECRET ?? process.env.JWT_SECRET ?? 'change-me-rsvp-link-secret';
const RSVP_LINK_BASE_URL =
  process.env.RSVP_LINK_BASE_URL ??
  process.env.VITE_API_URL ??
  process.env.PUBLIC_API_URL ??
  'http://localhost:4000';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? '587');
const SMTP_SECURE = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'SquadronForge <no-reply@squadronforge.local>';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type ParsedMember = {
  capid: string;
  firstName: string;
  lastName: string;
  grade?: string;
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

type ParsedCadetPromotion = {
  capid: string;
  memberName?: string;
  rank?: string;
  achievementName?: string;
  achievementCode?: number;
  datePromotionEligible?: Date;
  lastPtDate?: Date;
  ptDate?: Date;
  leadershipTestDate?: Date;
  leadershipModuleDate?: Date;
  aeTestDate?: Date;
  aeModuleDate?: Date;
  drillDate?: Date;
  moralForumDate?: Date;
  welcomeCourseDate?: Date;
  staffServiceDate?: Date;
  oralPresentationDate?: Date;
  leadershipTestNotRequired: boolean;
  leadershipModuleNotRequired: boolean;
  aeTestNotRequired: boolean;
  aeModuleNotRequired: boolean;
  drillNotRequired: boolean;
  requiresCD: boolean;
  requiresSDA: boolean;
  isFirstAchievement: boolean;
  inactive: boolean;
  ready: boolean;
  readyStatus?: string;
  leadershipTestCompleted: boolean;
  leadershipModuleCompleted: boolean;
  aeTestCompleted?: boolean;
  aeModuleCompleted?: boolean;
  chiefSpeechEssayCompleted: boolean;
  sdaCompleted: boolean;
  ptStatus?: string;
  leadStatus?: string;
  aeStatus?: string;
  drillStatus?: string;
  cdStatus?: string;
  sdaStatus?: string;
  comments?: string;
  sourceRow?: number;
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

const detectCadetPromotionFileByHeader = async (files: string[]): Promise<string | undefined> => {
  for (const file of files) {
    const text = await fsPromises.readFile(file, 'utf8');
    const first = text.split(/\r?\n/)[0]?.toLowerCase() ?? '';
    const hasCapid = first.includes('capid');
    const hasAchievement = first.includes('achvname') || first.includes('achievement');
    const hasEligibility = first.includes('nextapprovaldate') || first.includes('promotion eligable') || first.includes('promotion eligible');
    if (hasCapid && hasAchievement && hasEligibility) {
      return file;
    }
  }
  return undefined;
};

const discoverCapwatchFiles = async (
  extractedDir: string,
  mapping: Record<string, string> | undefined
): Promise<{
  organization?: string;
  membership?: string;
  dutyPosition?: string;
  dutyPositionFiles: string[];
  memberContact?: string;
  memberAddress?: string;
  cadetPromotion?: string;
  files: string[];
}> => {
  const files = await listFilesRecursive(extractedDir);
  const relativeFiles = files.map((f) => path.relative(extractedDir, f));
  const lowerMap = new Map(relativeFiles.map((rf, idx) => [rf.toLowerCase(), files[idx]]));

  const organization = lowerMap.get('organization.txt');
  const mappedMembership = mapping?.membership ? lowerMap.get(mapping.membership.toLowerCase()) : undefined;
  const mappedDuty = mapping?.dutyPosition ? lowerMap.get(mapping.dutyPosition.toLowerCase()) : undefined;
  const mappedMemberContact = mapping?.memberContact ? lowerMap.get(mapping.memberContact.toLowerCase()) : undefined;
  const mappedMemberAddress = mapping?.memberAddress ? lowerMap.get(mapping.memberAddress.toLowerCase()) : undefined;
  const mappedCadetPromotion = mapping?.cadetPromotion ? lowerMap.get(mapping.cadetPromotion.toLowerCase()) : undefined;

  const preferredMembership = lowerMap.get('member.txt') ?? lowerMap.get('membership.txt');
  const preferredDuty = lowerMap.get('dutyposition.txt') ?? lowerMap.get('cadetdutypositions.txt');
  const preferredCadetDuty = lowerMap.get('cadetdutypositions.txt');
  const preferredMemberContact = lowerMap.get('mbrcontact.txt');
  const preferredMemberAddress = lowerMap.get('mbraddresses.txt');
  const preferredCadetPromotion = lowerMap.get('cadetachvfullreport.txt');

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

  const cadetPromotionByHeuristic = files.find((fullPath) => {
    const name = path.basename(fullPath).toLowerCase();
    return name.includes('cadetachvfullreport') || name.includes('cadetachv');
  });

  const membership = mappedMembership ?? preferredMembership ?? membershipByHeuristic ?? (await detectMembershipFileByHeader(files));
  const dutyPosition = mappedDuty ?? preferredDuty ?? dutyByHeuristic ?? (await detectDutyFileByHeader(files));
  const dutyPositionFiles = [...new Set([dutyPosition, preferredCadetDuty].filter((value): value is string => Boolean(value)))];
  const memberContact = mappedMemberContact ?? preferredMemberContact ?? memberContactByHeuristic;
  const memberAddress = mappedMemberAddress ?? preferredMemberAddress ?? memberAddressByHeuristic;
  const cadetPromotion = mappedCadetPromotion ?? preferredCadetPromotion ?? cadetPromotionByHeuristic ?? (await detectCadetPromotionFileByHeader(files));

  return { organization, membership, dutyPosition, dutyPositionFiles, memberContact, memberAddress, cadetPromotion, files: relativeFiles };
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

const splitDelimitedLine = (line: string, delimiter: string): string[] => {
  if (delimiter !== ',') {
    return line.split(delimiter);
  }

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const parseDateOrUndefined = (value: string | undefined): Date | undefined => {
  const normalized = normalizeCell(value);
  if (!normalized || normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'n/a') {
    return undefined;
  }

  const parsed = parseDateSafe(normalized);
  if (!parsed) {
    return undefined;
  }

  if (parsed.getFullYear() <= 1900) {
    return undefined;
  }
  return parsed;
};

const parseCapwatchDate = (value: string | undefined, fieldName: string, capid: string): Date | undefined => {
  const normalized = normalizeCell(value);
  if (!normalized || normalized.toLowerCase() === 'none' || normalized.toLowerCase() === 'n/a') {
    return undefined;
  }

  const parsed = parseDateSafe(normalized);
  if (!parsed || parsed.getFullYear() <= 1900) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'invalid_capwatch_date',
        capid,
        fieldName,
        value: normalized
      })
    );
    return undefined;
  }

  return parsed;
};

const isNotApplicableValue = (value: string | undefined): boolean => {
  const normalized = normalizeCell(value).toLowerCase();
  return normalized === 'n/a' || normalized === 'na';
};

const ACHIEVEMENT_RULES: Record<number, { requiresCD: boolean; requiresSDA: boolean; isFirstAchievement: boolean }> = {
  1: { requiresCD: true, requiresSDA: false, isFirstAchievement: true },
  2: { requiresCD: true, requiresSDA: false, isFirstAchievement: false },
  3: { requiresCD: true, requiresSDA: false, isFirstAchievement: false },
  4: { requiresCD: false, requiresSDA: false, isFirstAchievement: false },
  5: { requiresCD: true, requiresSDA: false, isFirstAchievement: false },
  6: { requiresCD: true, requiresSDA: false, isFirstAchievement: false },
  7: { requiresCD: true, requiresSDA: false, isFirstAchievement: false },
  8: { requiresCD: false, requiresSDA: false, isFirstAchievement: false },
  9: { requiresCD: true, requiresSDA: true, isFirstAchievement: false },
  10: { requiresCD: true, requiresSDA: true, isFirstAchievement: false },
  11: { requiresCD: false, requiresSDA: true, isFirstAchievement: false },
  12: { requiresCD: true, requiresSDA: true, isFirstAchievement: false },
  13: { requiresCD: false, requiresSDA: true, isFirstAchievement: false },
  14: { requiresCD: true, requiresSDA: true, isFirstAchievement: false },
  15: { requiresCD: true, requiresSDA: true, isFirstAchievement: false },
  16: { requiresCD: false, requiresSDA: true, isFirstAchievement: false }
};

const parseAchievementCode = (value: string | undefined): number | undefined => {
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) return undefined;

  const directNumber = Number(normalized);
  if (Number.isInteger(directNumber) && directNumber > 0) {
    return directNumber;
  }

  const match = normalized.match(/achievement\s*(\d+)/i);
  if (match) {
    return Number(match[1]);
  }

  if (normalized.includes('wright')) return 4;
  if (normalized.includes('mitchell')) return 8;
  if (normalized.includes('earhart')) return 11;
  if (normalized.includes('eaker')) return 13;
  if (normalized.includes('spaatz')) return 16;

  return undefined;
};

const getAchievementRules = (achievementCode: number | undefined): { requiresCD: boolean; requiresSDA: boolean; isFirstAchievement: boolean } => {
  if (achievementCode && ACHIEVEMENT_RULES[achievementCode]) {
    return ACHIEVEMENT_RULES[achievementCode];
  }

  if (achievementCode === undefined) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'unknown_achievement_code', fallback: true }));
  } else {
    console.warn(JSON.stringify({ level: 'warn', msg: 'unmapped_achievement_code', achievementCode, fallback: true }));
  }

  return {
    requiresCD: true,
    requiresSDA: true,
    isFirstAchievement: false
  };
};

const parseBooleanToken = (value: string | undefined): boolean | undefined => {
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized || normalized === 'n/a' || normalized === 'na' || normalized === 'none') {
    return undefined;
  }
  if (['true', 'yes', 'y', '1', 'x', '★'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'n', '0'].includes(normalized)) {
    return false;
  }
  return undefined;
};

const parseCompletionToken = (value: string | undefined): boolean | undefined => {
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized || normalized === 'none' || normalized === 'na' || normalized === 'n/a') {
    return undefined;
  }

  const bool = parseBooleanToken(value);
  if (bool !== undefined) {
    return bool;
  }

  if (parseDateOrUndefined(value)) {
    return true;
  }

  return true;
};

const isNotApplicableToken = (value: string | undefined): boolean => {
  const normalized = normalizeCell(value).toLowerCase();
  return normalized === 'na' || normalized === 'n/a';
};

const normalizeStatusValue = (value: string | undefined): string | undefined => {
  const normalized = normalizeCell(value);
  return normalized.length > 0 ? normalized : undefined;
};

const deriveLeadOrAeStatus = (
  explicitStatus: string | undefined,
  rawA: string | undefined,
  rawB: string | undefined,
  completedA: boolean,
  completedB: boolean
): string | undefined => {
  if (explicitStatus) {
    return explicitStatus;
  }

  if (isNotApplicableToken(rawA) && isNotApplicableToken(rawB)) {
    return 'N/A';
  }

  if (completedA && completedB) {
    return '★';
  }

  if (completedA || completedB) {
    return 'X';
  }

  return undefined;
};

const derivePtStatus = (explicitStatus: string | undefined, lastPtDate: Date | undefined): string | undefined => {
  if (explicitStatus) {
    return explicitStatus;
  }

  if (!lastPtDate) {
    return undefined;
  }

  const expiration = new Date(lastPtDate);
  expiration.setDate(expiration.getDate() + 182);
  return expiration > new Date() ? 'X' : undefined;
};

const computeReadyFromSheetLogic = (
  inactive: boolean,
  ptStatus: string | undefined,
  leadStatus: string | undefined,
  aeStatus: string | undefined,
  drillStatus: string | undefined,
  cdStatus: string | undefined,
  sdaStatus: string | undefined
): boolean => {
  const required = inactive
    ? [ptStatus, leadStatus, aeStatus, drillStatus, cdStatus, sdaStatus]
    : [ptStatus, leadStatus, aeStatus, drillStatus, cdStatus];

  if (required.some((status) => !normalizeStatusValue(status))) {
    return false;
  }

  if (normalizeStatusValue(cdStatus)?.toUpperCase() === 'WC') {
    return false;
  }

  return true;
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
  const header = splitDelimitedLine(lines[0], delimiter).map((c) => c.trim().toLowerCase());
  const indexOfAny = (...names: string[]): number => header.findIndex((h) => names.includes(h));

  const idx = {
    capid: indexOfAny('capid'),
    firstName: indexOfAny('firstname', 'namefirst'),
    lastName: indexOfAny('lastname', 'namelast'),
    grade: indexOfAny('grade', 'rank', 'capgrade', 'mbrgrade'),
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
    const cols = splitDelimitedLine(line, delimiter).map((v) => normalizeCell(v));
    return {
      capid: cols[idx.capid] ?? '',
      firstName: cols[idx.firstName] ?? '',
      lastName: cols[idx.lastName] ?? '',
      grade: idx.grade >= 0 ? cols[idx.grade] || undefined : undefined,
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
  const header = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
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
    const cols = splitDelimitedLine(line, delimiter).map((v) => normalizeCell(v));
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
  const header = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
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
    const cols = splitDelimitedLine(line, delimiter).map((v) => normalizeCell(v));
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
  const header = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
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
    const cols = splitDelimitedLine(line, delimiter).map((v) => normalizeCell(v));
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

const parseCadetPromotionFile = async (cadetPromotionFile: string): Promise<ParsedCadetPromotion[]> => {
  const raw = await fsPromises.readFile(cadetPromotionFile, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
  const indexOfAny = (...names: string[]): number => header.findIndex((h) => names.includes(h));

  const idx = {
    sourceRow: indexOfAny('source row #'),
    achievementName: indexOfAny('achievement id', 'achvname', 'achievement'),
    promotionEligible: indexOfAny('date promotion eligable', 'date promotion eligible', 'nextapprovaldate'),
    lastPtDate: indexOfAny('last pt date', 'phyfittest'),
    ptDate: indexOfAny('phyfittest', 'last pt date'),
    inactive: indexOfAny('inactive?'),
    ready: indexOfAny('ready?', 'ready'),
    readyDate: indexOfAny('ready date', 'date ready', 'dateready', 'date when ready', 'projected ready date'),
    leadershipTestCompleted: indexOfAny('leadership test completed', 'leadlabdatep', 'leadlabdate'),
    leadershipModuleCompleted: indexOfAny('leadership module completed', 'leadershipinteractivedate'),
    aeTestCompleted: indexOfAny('ae test completed', 'aedatep', 'aedate'),
    aeModuleCompleted: indexOfAny('ae module completed', 'aeinteractivedate'),
    drillDate: indexOfAny('drilldate', 'drill date'),
    moralForumDate: indexOfAny('moraldatep', 'moral date', 'characterdevelopmentdate'),
    welcomeCourseDate: indexOfAny('welcomecoursedate', 'welcome course date'),
    staffServiceDate: indexOfAny('staffservicedate', 'staff service date'),
    oralPresentationDate: indexOfAny('oralpresentationdate', 'oral presentation date', 'speechdate', 'essaydate'),
    chiefSpeechEssayCompleted: indexOfAny('chief speech / essay completed', 'speechdate', 'essaydate', 'oralpresentationdate'),
    sdaCompleted: indexOfAny('sda completed', 'technicalwritingassignmentdate', 'staffservicedate', 'oralpresentationdate'),
    memberName: indexOfAny('name'),
    capid: indexOfAny('capid'),
    rank: indexOfAny('rank'),
    ptStatus: indexOfAny('pt', 'ptstatus', 'physical fitness'),
    leadStatus: indexOfAny('lead', 'leadstatus', 'leadership'),
    aeStatus: indexOfAny('ae', 'aestatus', 'aerospace education'),
    drillStatus: indexOfAny('drill', 'drillstatus'),
    cdStatus: indexOfAny('cd', 'cdstatus', 'character development'),
    sdaStatus: indexOfAny('sda', 'sdastatus'),
    comments: indexOfAny('comments')
  };

  if (idx.capid < 0) {
    return [];
  }

  const rows = lines.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter).map((v) => normalizeCell(v));
    const capid = cols[idx.capid] ?? '';
    const leadershipTestRaw = idx.leadershipTestCompleted >= 0 ? cols[idx.leadershipTestCompleted] : undefined;
    const leadershipModuleRaw = idx.leadershipModuleCompleted >= 0 ? cols[idx.leadershipModuleCompleted] : undefined;
    const aeTestRaw = idx.aeTestCompleted >= 0 ? cols[idx.aeTestCompleted] : undefined;
    const aeModuleRaw = idx.aeModuleCompleted >= 0 ? cols[idx.aeModuleCompleted] : undefined;
    const chiefRaw = idx.chiefSpeechEssayCompleted >= 0 ? cols[idx.chiefSpeechEssayCompleted] : undefined;
    const sdaRaw = idx.sdaCompleted >= 0 ? cols[idx.sdaCompleted] : undefined;

    const leadershipTest = parseCompletionToken(leadershipTestRaw);
    const leadershipModule = parseCompletionToken(leadershipModuleRaw);
    const aeTest = parseCompletionToken(aeTestRaw);
    const aeModule = parseCompletionToken(aeModuleRaw);
    const chief = parseCompletionToken(chiefRaw);
    const sda = parseCompletionToken(sdaRaw);

    const achievementName = idx.achievementName >= 0 ? cols[idx.achievementName] || undefined : undefined;
    const achievementCode = parseAchievementCode(achievementName);
    const rules = getAchievementRules(achievementCode);

    const eligibleDate = idx.promotionEligible >= 0 ? parseDateOrUndefined(cols[idx.promotionEligible]) : undefined;
    const isInactive = idx.inactive >= 0 ? parseBooleanToken(cols[idx.inactive]) === true : false;
    const readyFlag = idx.ready >= 0 ? parseBooleanToken(cols[idx.ready]) : undefined;
    const readyToken = idx.ready >= 0 ? normalizeStatusValue(cols[idx.ready]) : undefined;
    const readyDateToken = idx.readyDate >= 0 ? normalizeStatusValue(cols[idx.readyDate]) : undefined;
    const readyStatus = readyDateToken ?? readyToken;

    const lastPtDate = idx.lastPtDate >= 0 ? parseDateOrUndefined(cols[idx.lastPtDate]) : undefined;
    const ptDate = idx.ptDate >= 0 ? parseCapwatchDate(cols[idx.ptDate], 'PhyFitTest', capid) : undefined;
    const leadershipTestDate = idx.leadershipTestCompleted >= 0 ? parseCapwatchDate(leadershipTestRaw, 'LeadLabDateP', capid) : undefined;
    const leadershipModuleDate = idx.leadershipModuleCompleted >= 0 ? parseCapwatchDate(leadershipModuleRaw, 'LeadershipInteractiveDate', capid) : undefined;
    const aeTestDate = idx.aeTestCompleted >= 0 ? parseCapwatchDate(aeTestRaw, 'AEDateP', capid) : undefined;
    const aeModuleDate = idx.aeModuleCompleted >= 0 ? parseCapwatchDate(aeModuleRaw, 'AEInteractiveDate', capid) : undefined;
    const drillDateRaw = idx.drillDate >= 0 ? cols[idx.drillDate] : undefined;
    const drillDate = idx.drillDate >= 0 ? parseCapwatchDate(drillDateRaw, 'DrillDate', capid) : undefined;
    const moralForumRaw = idx.moralForumDate >= 0 ? cols[idx.moralForumDate] : undefined;
    const moralForumDate = idx.moralForumDate >= 0 ? parseCapwatchDate(moralForumRaw, 'MoralDateP', capid) : undefined;
    const welcomeCourseRaw = idx.welcomeCourseDate >= 0 ? cols[idx.welcomeCourseDate] : undefined;
    const welcomeCourseDate = idx.welcomeCourseDate >= 0 ? parseCapwatchDate(welcomeCourseRaw, 'WelcomeCourseDate', capid) : undefined;
    const staffServiceRaw = idx.staffServiceDate >= 0 ? cols[idx.staffServiceDate] : undefined;
    const staffServiceDate = idx.staffServiceDate >= 0 ? parseCapwatchDate(staffServiceRaw, 'StaffServiceDate', capid) : undefined;
    const oralPresentationRaw = idx.oralPresentationDate >= 0 ? cols[idx.oralPresentationDate] : undefined;
    const oralPresentationDate = idx.oralPresentationDate >= 0 ? parseCapwatchDate(oralPresentationRaw, 'OralPresentationDate', capid) : undefined;
    const explicitPtStatus = idx.ptStatus >= 0 ? normalizeStatusValue(cols[idx.ptStatus]) : undefined;
    const explicitLeadStatus = idx.leadStatus >= 0 ? normalizeStatusValue(cols[idx.leadStatus]) : undefined;
    const explicitAeStatus = idx.aeStatus >= 0 ? normalizeStatusValue(cols[idx.aeStatus]) : undefined;
    const drillStatus = idx.drillStatus >= 0 ? normalizeStatusValue(cols[idx.drillStatus]) : undefined;
    const explicitCdStatus = idx.cdStatus >= 0 ? normalizeStatusValue(cols[idx.cdStatus]) : undefined;
    const explicitSdaStatus = idx.sdaStatus >= 0 ? normalizeStatusValue(cols[idx.sdaStatus]) : undefined;

    const ptStatus = derivePtStatus(explicitPtStatus, lastPtDate);
    const leadStatus = deriveLeadOrAeStatus(
      explicitLeadStatus,
      leadershipTestRaw,
      leadershipModuleRaw,
      leadershipTest ?? false,
      leadershipModule ?? false
    );
    const aeStatus = deriveLeadOrAeStatus(
      explicitAeStatus,
      aeTestRaw,
      aeModuleRaw,
      aeTest ?? false,
      aeModule ?? false
    );
    const cdStatus = explicitCdStatus ?? (chief ? 'X' : undefined);
    const sdaStatus = explicitSdaStatus ?? (sda ? 'X' : undefined);

    const hasSheetStatusColumns = [ptStatus, leadStatus, aeStatus, drillStatus, cdStatus, sdaStatus].some(
      (status) => normalizeStatusValue(status) !== undefined
    );

    const ready = hasSheetStatusColumns
      ? computeReadyFromSheetLogic(isInactive, ptStatus, leadStatus, aeStatus, drillStatus, cdStatus, sdaStatus)
      : !isInactive && readyFlag === true;

    return {
      capid,
      memberName: idx.memberName >= 0 ? cols[idx.memberName] || undefined : undefined,
      rank: idx.rank >= 0 ? cols[idx.rank] || undefined : undefined,
      achievementName,
      achievementCode,
      datePromotionEligible: eligibleDate,
      lastPtDate,
      ptDate,
      leadershipTestDate,
      leadershipModuleDate,
      aeTestDate,
      aeModuleDate,
      drillDate,
      moralForumDate,
      welcomeCourseDate,
      staffServiceDate,
      oralPresentationDate,
      leadershipTestNotRequired: isNotApplicableValue(leadershipTestRaw),
      leadershipModuleNotRequired: isNotApplicableValue(leadershipModuleRaw),
      aeTestNotRequired: isNotApplicableValue(aeTestRaw),
      aeModuleNotRequired: isNotApplicableValue(aeModuleRaw),
      drillNotRequired: isNotApplicableValue(drillDateRaw),
      requiresCD: rules.requiresCD,
      requiresSDA: rules.requiresSDA,
      isFirstAchievement: rules.isFirstAchievement,
      inactive: isInactive,
      ready,
      readyStatus,
      leadershipTestCompleted: leadershipTest ?? false,
      leadershipModuleCompleted: leadershipModule ?? false,
      aeTestCompleted: aeTest,
      aeModuleCompleted: aeModule,
      chiefSpeechEssayCompleted: chief ?? false,
      sdaCompleted: sda ?? false,
      ptStatus,
      leadStatus,
      aeStatus,
      drillStatus,
      cdStatus,
      sdaStatus,
      comments: idx.comments >= 0 ? cols[idx.comments] || undefined : undefined,
      sourceRow: idx.sourceRow >= 0 ? Number(cols[idx.sourceRow]) || undefined : undefined
    } satisfies ParsedCadetPromotion;
  });

  return rows.filter((r) => r.capid.length > 0);
};

const dedupeCadetPromotionsByCapid = (rows: ParsedCadetPromotion[]): ParsedCadetPromotion[] => {
  const byCapid = new Map<string, ParsedCadetPromotion>();

  const score = (row: ParsedCadetPromotion): number => {
    const eligibleScore = row.datePromotionEligible ? row.datePromotionEligible.getTime() / 1_000_000_000 : 0;
    return (
      (row.ready ? 1_000_000_000 : 0) +
      (row.inactive ? 0 : 100_000_000) +
      (row.sourceRow ?? 0) +
      eligibleScore
    );
  };

  for (const row of rows) {
    const existing = byCapid.get(row.capid);
    if (!existing) {
      byCapid.set(row.capid, row);
      continue;
    }

    if (score(row) >= score(existing)) {
      byCapid.set(row.capid, row);
    }
  }

  return [...byCapid.values()];
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

let emailTransporter: nodemailer.Transporter | null | undefined;

const getEmailTransporter = (): nodemailer.Transporter | null => {
  if (emailTransporter !== undefined) {
    return emailTransporter;
  }

  if (!SMTP_HOST) {
    emailTransporter = null;
    return emailTransporter;
  }

  emailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {})
  });

  return emailTransporter;
};

type SignedRsvpPayload = {
  tenantId: string;
  eventId: string;
  status: 'yes' | 'no' | 'maybe';
  source: 'email-link' | 'push-link';
  exp: number;
  userId?: string;
  capid?: string;
  email?: string;
  name?: string;
};

const signRsvpToken = (payload: SignedRsvpPayload): string => {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', RSVP_LINK_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

const buildRsvpLink = (payload: SignedRsvpPayload): string => {
  const token = signRsvpToken(payload);
  return `${RSVP_LINK_BASE_URL.replace(/\/$/, '')}/tenant/rsvp/${token}`;
};

const buildAudienceMemberWhere = (event: {
  tenantId: string;
  visibility: 'tenant' | 'audience';
  audienceRules: Array<{ memberType: 'CADET' | 'SENIOR' | 'UNKNOWN' | null; unitCharter: string | null }>;
}) => {
  const base = {
    tenantId: event.tenantId,
    status: 'ACTIVE' as const,
    email: { not: null as any }
  };

  if (event.visibility !== 'audience' || event.audienceRules.length === 0) {
    return base;
  }

  const orRules = event.audienceRules.map((rule) => ({
    ...(rule.memberType ? { memberType: rule.memberType } : {}),
    ...(rule.unitCharter ? { unitCharter: rule.unitCharter } : {})
  }));

  const filtered = orRules.filter((rule) => Object.keys(rule).length > 0);
  if (filtered.length === 0) {
    return base;
  }

  return {
    ...base,
    OR: filtered
  };
};

const scheduleEventNotificationsLoop = async () => {
  const due = await prisma.eventNotification.findMany({
    where: {
      status: 'queued',
      scheduledAt: { lte: new Date() }
    },
    orderBy: { scheduledAt: 'asc' },
    take: 200,
    select: { id: true }
  });

  await Promise.all(
    due.map((row: (typeof due)[number]) =>
      notificationQueue.add('dispatch-notification', { notificationId: row.id }, { jobId: `event-notification-${row.id}`, removeOnComplete: 200, removeOnFail: 500 })
    )
  );
};

const dispatchEmailNotification = async (notificationId: string): Promise<{ status: 'sent' | 'failed' | 'skipped'; message: string }> => {
  const transporter = getEmailTransporter();
  if (!transporter) {
    return { status: 'skipped', message: 'SMTP not configured' };
  }

  const notification = await prisma.eventNotification.findUnique({
    where: { id: notificationId },
    include: {
      event: {
        include: { audienceRules: true, audienceMembers: true, externalRecipients: true }
      }
    }
  });

  if (!notification?.event) {
    return { status: 'failed', message: 'Event notification record not found' };
  }

  const groupMembers = await prisma.member.findMany({
    where: buildAudienceMemberWhere({
      tenantId: notification.tenantId,
      visibility: notification.event.visibility,
      audienceRules: notification.event.audienceRules.map((rule: (typeof notification.event.audienceRules)[number]) => ({
        memberType: rule.memberType,
        unitCharter: rule.unitCharter
      }))
    }),
    select: {
      email: true,
      capid: true,
      firstName: true,
      lastName: true
    }
  });

  const explicitCapids = [...new Set(notification.event.audienceMembers.map((member: (typeof notification.event.audienceMembers)[number]) => member.capid).filter(Boolean))];
  const explicitMembers =
    explicitCapids.length > 0
      ? await prisma.member.findMany({
          where: {
            tenantId: notification.tenantId,
            capid: { in: explicitCapids },
            email: { not: null as any }
          },
          select: {
            email: true,
            capid: true,
            firstName: true,
            lastName: true
          }
        })
      : [];

  const uniqueByEmail = new Map<string, { email: string; name: string; capid?: string; externalName?: string }>();

  for (const member of [...groupMembers, ...explicitMembers]) {
    const email = (member.email ?? '').trim().toLowerCase();
    if (email) {
      uniqueByEmail.set(email, {
        email,
        name: `${member.firstName} ${member.lastName}`.trim() || 'member',
        capid: member.capid
      });
    }
  }

  for (const recipient of notification.event.externalRecipients) {
    const email = recipient.email.trim().toLowerCase();
    if (email) {
      uniqueByEmail.set(email, {
        email,
        name: recipient.name?.trim() || email,
        externalName: recipient.name?.trim() || undefined
      });
    }
  }

  if (uniqueByEmail.size === 0) {
    return { status: 'skipped', message: 'No active members with email recipients' };
  }

  const eventStarts = notification.event.startsAt.toLocaleString();
  const eventEnds = notification.event.endsAt.toLocaleString();
  const expiresAt = Math.floor(Date.now() / 1000) + 72 * 60 * 60;

  let sentCount = 0;
  for (const recipient of uniqueByEmail.values()) {
    const identity = recipient.capid
      ? { capid: recipient.capid }
      : {
          email: recipient.email,
          ...(recipient.externalName ? { name: recipient.externalName } : {})
        };

    const yesLink = buildRsvpLink({
      tenantId: notification.tenantId,
      eventId: notification.eventId,
      ...identity,
      status: 'yes',
      source: 'email-link',
      exp: expiresAt
    });
    const maybeLink = buildRsvpLink({
      tenantId: notification.tenantId,
      eventId: notification.eventId,
      ...identity,
      status: 'maybe',
      source: 'email-link',
      exp: expiresAt
    });
    const noLink = buildRsvpLink({
      tenantId: notification.tenantId,
      eventId: notification.eventId,
      ...identity,
      status: 'no',
      source: 'email-link',
      exp: expiresAt
    });

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipient.email,
      subject: `[SquadronForge] ${notification.type.toUpperCase()}: ${notification.event.title}`,
      html: `
        <p>Hello ${recipient.name || 'member'},</p>
        <p><strong>${notification.event.title}</strong></p>
        <p>Starts: ${eventStarts}<br/>Ends: ${eventEnds}<br/>Location: ${notification.event.location ?? 'TBD'}</p>
        <p>Quick RSVP:</p>
        <p>
          <a href="${yesLink}">Yes</a> |
          <a href="${maybeLink}">Maybe</a> |
          <a href="${noLink}">No</a>
        </p>
      `
    });
    sentCount += 1;
  }

  return { status: 'sent', message: `Email sent to ${sentCount} recipients` };
};

const dispatchPushNotification = async (notificationId: string): Promise<{ status: 'sent' | 'failed' | 'skipped'; message: string }> => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { status: 'skipped', message: 'VAPID keys not configured' };
  }

  const notification = await prisma.eventNotification.findUnique({
    where: { id: notificationId },
    include: {
      event: true,
      tenant: {
        select: { slug: true }
      }
    }
  });

  if (!notification?.event) {
    return { status: 'failed', message: 'Event notification record not found' };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { tenantId: notification.tenantId },
    select: { id: true, endpoint: true, p256dh: true, auth: true }
  });

  if (subscriptions.length === 0) {
    return { status: 'skipped', message: 'No push subscriptions registered' };
  }

  const payload = JSON.stringify({
    title: `Event ${notification.type}: ${notification.event.title}`,
    body: `${notification.event.startsAt.toLocaleString()} • ${notification.event.location ?? 'Location TBD'}`,
    url: `/${notification.tenant.slug}/events`
  });

  let successCount = 0;
  let failureCount = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        payload
      );
      successCount += 1;
    } catch (error: any) {
      failureCount += 1;
      const statusCode = Number(error?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } });
      }
    }
  }

  if (successCount > 0) {
    return { status: 'sent', message: `Push sent to ${successCount} subscriptions${failureCount > 0 ? `, ${failureCount} failed` : ''}` };
  }
  if (failureCount > 0) {
    return { status: 'failed', message: `Push delivery failed for ${failureCount} subscriptions` };
  }
  return { status: 'skipped', message: 'No push notifications delivered' };
};

const dispatchTestEmail = async (payload: {
  tenantId: string;
  to: string;
  subject: string;
  message: string;
  requestedByUserId?: string;
  requestedAt?: string;
}): Promise<{ status: 'sent' | 'failed' | 'skipped'; message: string }> => {
  const transporter = getEmailTransporter();
  if (!transporter) {
    return { status: 'skipped', message: 'SMTP not configured' };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId }, select: { name: true, slug: true } });

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: `
      <p>${payload.message}</p>
      <hr />
      <p><strong>Tenant:</strong> ${tenant?.name ?? payload.tenantId} (${tenant?.slug ?? 'unknown'})</p>
      <p><strong>Requested at:</strong> ${payload.requestedAt ?? new Date().toISOString()}</p>
      <p><strong>Requested by user:</strong> ${payload.requestedByUserId ?? 'unknown'}</p>
    `
  });

  return { status: 'sent', message: `Test email sent to ${payload.to}` };
};

const dispatchTestEventRsvpEmail = async (payload: {
  tenantId: string;
  eventId: string;
  to: string;
  requestedByUserId: string;
  requestedAt?: string;
}): Promise<{ status: 'sent' | 'failed' | 'skipped'; message: string }> => {
  const transporter = getEmailTransporter();
  if (!transporter) {
    return { status: 'skipped', message: 'SMTP not configured' };
  }

  const event = await prisma.event.findFirst({
    where: { id: payload.eventId, tenantId: payload.tenantId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isCancelled: true
    }
  });

  if (!event) {
    return { status: 'failed', message: 'Event not found for RSVP test email' };
  }
  if (event.isCancelled) {
    return { status: 'skipped', message: 'Event is cancelled' };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 72 * 60 * 60;
  const yesLink = buildRsvpLink({
    tenantId: payload.tenantId,
    eventId: payload.eventId,
    userId: payload.requestedByUserId,
    status: 'yes',
    source: 'email-link',
    exp: expiresAt
  });
  const maybeLink = buildRsvpLink({
    tenantId: payload.tenantId,
    eventId: payload.eventId,
    userId: payload.requestedByUserId,
    status: 'maybe',
    source: 'email-link',
    exp: expiresAt
  });
  const noLink = buildRsvpLink({
    tenantId: payload.tenantId,
    eventId: payload.eventId,
    userId: payload.requestedByUserId,
    status: 'no',
    source: 'email-link',
    exp: expiresAt
  });

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: payload.to,
    subject: `[SquadronForge] Test RSVP links for ${event.title}`,
    html: `
      <p>This is a test RSVP notification email.</p>
      <p><strong>${event.title}</strong></p>
      <p>Starts: ${event.startsAt.toLocaleString()}<br/>Ends: ${event.endsAt.toLocaleString()}<br/>Location: ${event.location ?? 'TBD'}</p>
      <p>Test links:</p>
      <p>
        <a href="${yesLink}">Yes</a> |
        <a href="${maybeLink}">Maybe</a> |
        <a href="${noLink}">No</a>
      </p>
      <hr />
      <p><strong>Requested at:</strong> ${payload.requestedAt ?? new Date().toISOString()}</p>
    `
  });

  return { status: 'sent', message: `Test event RSVP email sent to ${payload.to}` };
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

scheduleEventNotificationsLoop().catch((error) => {
  console.error(JSON.stringify({ level: 'error', msg: 'initial_event_notification_schedule_failed', error: String(error) }));
});

setInterval(() => {
  scheduleLoop().catch((error) => {
    console.error(JSON.stringify({ level: 'error', msg: 'schedule_loop_failed', error: String(error) }));
  });
}, 60_000);

setInterval(() => {
  scheduleEventNotificationsLoop().catch((error) => {
    console.error(JSON.stringify({ level: 'error', msg: 'event_notification_schedule_loop_failed', error: String(error) }));
  });
}, 60_000);

new Worker(
  'event-notifications',
  async (job) => {
    if (job.name === 'send-test-event-rsvp') {
      const data = job.data as {
        logId: string;
        tenantId: string;
        eventId: string;
        to: string;
        requestedByUserId: string;
        requestedAt?: string;
      };

      try {
        const result = await dispatchTestEventRsvpEmail(data);
        if (result.status === 'failed') {
          await prisma.testEmailLog.update({
            where: { id: data.logId },
            data: {
              status: 'failed',
              errorMessage: result.message,
              sentAt: null
            }
          });
          throw new Error(result.message);
        }
        if (result.status === 'skipped') {
          await prisma.testEmailLog.update({
            where: { id: data.logId },
            data: {
              status: 'skipped',
              errorMessage: result.message,
              sentAt: null
            }
          });
          console.warn(JSON.stringify({ level: 'warn', msg: 'test_event_rsvp_email_skipped', reason: result.message, to: data.to }));
        } else {
          await prisma.testEmailLog.update({
            where: { id: data.logId },
            data: {
              status: 'sent',
              errorMessage: null,
              sentAt: new Date()
            }
          });
          console.log(JSON.stringify({ level: 'info', msg: 'test_event_rsvp_email_sent', to: data.to, eventId: data.eventId }));
        }
        return;
      } catch (error) {
        await prisma.testEmailLog.update({
          where: { id: data.logId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Test event RSVP email failed',
            sentAt: null
          }
        });
        throw error;
      }
    }

    if (job.name === 'send-test-email') {
      const data = job.data as {
        logId: string;
        tenantId: string;
        to: string;
        subject: string;
        message: string;
        requestedByUserId?: string;
        requestedAt?: string;
      };

      try {
        const result = await dispatchTestEmail(data);
        if (result.status === 'failed') {
          await prisma.testEmailLog.update({
            where: { id: data.logId },
            data: {
              status: 'failed',
              errorMessage: result.message,
              sentAt: null
            }
          });
          throw new Error(result.message);
        }
        if (result.status === 'skipped') {
          await prisma.testEmailLog.update({
            where: { id: data.logId },
            data: {
              status: 'skipped',
              errorMessage: result.message,
              sentAt: null
            }
          });
          console.warn(JSON.stringify({ level: 'warn', msg: 'test_email_skipped', reason: result.message, to: data.to }));
        } else {
          await prisma.testEmailLog.update({
            where: { id: data.logId },
            data: {
              status: 'sent',
              errorMessage: null,
              sentAt: new Date()
            }
          });
          console.log(JSON.stringify({ level: 'info', msg: 'test_email_sent', to: data.to }));
        }
        return;
      } catch (error) {
        await prisma.testEmailLog.update({
          where: { id: data.logId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Test email failed',
            sentAt: null
          }
        });
        throw error;
      }
    }

    const notificationId = String(job.data.notificationId ?? '');
    if (!notificationId) {
      throw new Error('notificationId is required');
    }

    const notification = await prisma.eventNotification.findUnique({
      where: { id: notificationId },
      select: { id: true, status: true, channel: true }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status !== 'queued') {
      return;
    }

    const result =
      notification.channel === 'email'
        ? await dispatchEmailNotification(notificationId)
        : await dispatchPushNotification(notificationId);

    await prisma.eventNotification.update({
      where: { id: notificationId },
      data: {
        status: result.status,
        sentAt: result.status === 'sent' ? new Date() : null,
        errorMessage: result.status === 'failed' || result.status === 'skipped' ? result.message : null
      }
    });
  },
  { connection }
);

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
      const memberByCapid = new Map<string, { fullName: string; grade?: string }>();
      for (const member of members) {
        memberByCapid.set(member.capid, {
          fullName: `${member.lastName}, ${member.firstName}`,
          grade: member.grade
        });
      }
      const dutyPositionRows = await Promise.all(discovery.dutyPositionFiles.map((filePath) => parseDutyPositionFile(filePath)));
      const dutyPositionMerged = dutyPositionRows.flat();
      const dutyPositionKey = (duty: ParsedDutyPosition): string =>
        `${duty.capid}|${(duty.dutyName ?? '').toLowerCase()}|${(duty.dutyCode ?? '').toLowerCase()}|${duty.startDate?.toISOString() ?? ''}|${duty.endDate?.toISOString() ?? ''}`;
      const dutyPositions = [...new Map(dutyPositionMerged.map((row) => [dutyPositionKey(row), row])).values()];
      const memberContacts = discovery.memberContact ? await parseMemberContactFile(discovery.memberContact) : [];
      const memberAddresses = discovery.memberAddress ? await parseMemberAddressFile(discovery.memberAddress) : [];
      const cadetPromotionsRaw = discovery.cadetPromotion ? await parseCadetPromotionFile(discovery.cadetPromotion) : [];
      const cadetPromotions = dedupeCadetPromotionsByCapid(cadetPromotionsRaw);
      let upsertCount = 0;
      let activeCount = 0;
      let dutyUpserted = 0;
      let memberContactsImported = 0;
      let memberAddressesImported = 0;
      let cadetPromotionsImported = 0;

      await setRunStage(run.id, 'importing');

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const member of members) {
          await tx.member.upsert({
            where: { tenantId_capid: { tenantId, capid: member.capid } },
            update: {
              firstName: member.firstName,
              lastName: member.lastName,
              grade: member.grade,
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
              grade: member.grade,
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

        await tx.cadetPromotion.deleteMany({ where: { tenantId } });
        if (cadetPromotions.length > 0) {
          await tx.cadetPromotion.createMany({
            skipDuplicates: true,
            data: cadetPromotions.map((item) => ({
              tenantId,
              capid: item.capid,
              memberName: item.memberName ?? memberByCapid.get(item.capid)?.fullName,
              rank: item.rank ?? memberByCapid.get(item.capid)?.grade,
              achievementName: item.achievementName,
              achievementCode: item.achievementCode,
              datePromotionEligible: item.datePromotionEligible,
              lastPtDate: item.lastPtDate,
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
              leadershipTestNotRequired: item.leadershipTestNotRequired,
              leadershipModuleNotRequired: item.leadershipModuleNotRequired,
              aeTestNotRequired: item.aeTestNotRequired,
              aeModuleNotRequired: item.aeModuleNotRequired,
              drillNotRequired: item.drillNotRequired,
              requiresCD: item.requiresCD,
              requiresSDA: item.requiresSDA,
              isFirstAchievement: item.isFirstAchievement,
              inactive: item.inactive,
              ready: item.ready,
              readyStatus: item.readyStatus,
              leadershipTestCompleted: item.leadershipTestCompleted,
              leadershipModuleCompleted: item.leadershipModuleCompleted,
              aeTestCompleted: item.aeTestCompleted,
              aeModuleCompleted: item.aeModuleCompleted,
              chiefSpeechEssayCompleted: item.chiefSpeechEssayCompleted,
              sdaCompleted: item.sdaCompleted,
              ptStatus: item.ptStatus,
              leadStatus: item.leadStatus,
              aeStatus: item.aeStatus,
              drillStatus: item.drillStatus,
              cdStatus: item.cdStatus,
              sdaStatus: item.sdaStatus,
              comments: item.comments,
              sourceRow: item.sourceRow
            }))
          });
        }
        cadetPromotionsImported = cadetPromotions.length;
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
            dutyPositionFiles: discovery.dutyPositionFiles.map((filePath) => path.relative(extracted, filePath)),
            memberContactFile: discovery.memberContact ? path.relative(extracted, discovery.memberContact) : null,
            memberAddressFile: discovery.memberAddress ? path.relative(extracted, discovery.memberAddress) : null,
            cadetPromotionFile: discovery.cadetPromotion ? path.relative(extracted, discovery.cadetPromotion) : null,
            dutyPositionsUpserted: dutyUpserted,
            memberContactsImported,
            memberAddressesImported,
            cadetPromotionsImported,
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
