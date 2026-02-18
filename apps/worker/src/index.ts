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
  datePromotionEligible?: Date;
  lastPtDate?: Date;
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
): Promise<{ organization?: string; membership?: string; dutyPosition?: string; memberContact?: string; memberAddress?: string; cadetPromotion?: string; files: string[] }> => {
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
  const memberContact = mappedMemberContact ?? preferredMemberContact ?? memberContactByHeuristic;
  const memberAddress = mappedMemberAddress ?? preferredMemberAddress ?? memberAddressByHeuristic;
  const cadetPromotion = mappedCadetPromotion ?? preferredCadetPromotion ?? cadetPromotionByHeuristic ?? (await detectCadetPromotionFileByHeader(files));

  return { organization, membership, dutyPosition, memberContact, memberAddress, cadetPromotion, files: relativeFiles };
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
    inactive: indexOfAny('inactive?'),
    ready: indexOfAny('ready?', 'ready'),
    leadershipTestCompleted: indexOfAny('leadership test completed', 'leadlabdatep'),
    leadershipModuleCompleted: indexOfAny('leadership module completed', 'leadershipinteractivedate'),
    aeTestCompleted: indexOfAny('ae test completed', 'aedatep'),
    aeModuleCompleted: indexOfAny('ae module completed', 'aeinteractivedate'),
    chiefSpeechEssayCompleted: indexOfAny('chief speech / essay completed', 'speechdate', 'essaydate', 'oralpresentationdate'),
    sdaCompleted: indexOfAny('sda completed', 'technicalwritingassignmentdate'),
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

    const eligibleDate = idx.promotionEligible >= 0 ? parseDateOrUndefined(cols[idx.promotionEligible]) : undefined;
    const isInactive = idx.inactive >= 0 ? parseBooleanToken(cols[idx.inactive]) === true : false;
    const readyFlag = idx.ready >= 0 ? parseBooleanToken(cols[idx.ready]) : undefined;
    const readyStatus = idx.ready >= 0 ? normalizeStatusValue(cols[idx.ready]) : undefined;

    const lastPtDate = idx.lastPtDate >= 0 ? parseDateOrUndefined(cols[idx.lastPtDate]) : undefined;
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
      achievementName: idx.achievementName >= 0 ? cols[idx.achievementName] || undefined : undefined,
      datePromotionEligible: eligibleDate,
      lastPtDate,
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
      const memberByCapid = new Map<string, { fullName: string; grade?: string }>();
      for (const member of members) {
        memberByCapid.set(member.capid, {
          fullName: `${member.lastName}, ${member.firstName}`,
          grade: member.grade
        });
      }
      const dutyPositions = discovery.dutyPosition ? await parseDutyPositionFile(discovery.dutyPosition) : [];
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
              datePromotionEligible: item.datePromotionEligible,
              lastPtDate: item.lastPtDate,
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
