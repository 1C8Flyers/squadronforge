import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';

type DownloadInput = {
  orgid: number;
  unitOnly: boolean;
  credentialsRef: string;
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
    return fs.readFileSync(filePath, 'utf8').trim();
  }

  throw new Error(`Missing CAPWATCH credential: ${envKey} or ${envFileKey}`);
};

export const downloadCapwatchZip = async (input: DownloadInput): Promise<{ zipPath: string; checksum: string }> => {
  const capid = getCredential(input.credentialsRef, 'CAPID');
  const password = getCredential(input.credentialsRef, 'PASSWORD');

  const auth = Buffer.from(`${capid}:${password}`).toString('base64');
  const url = `https://www.capnhq.gov/CAP.CapWatchAPI.Web/api/cw?ORGID=${input.orgid}&unitOnly=${input.unitOnly ? 1 : 0}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`CAPWATCH download failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('zip')) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'capwatch-'));
  const zipPath = path.join(tempDir, 'capwatch.zip');

  const hash = crypto.createHash('sha256');
  const nodeStream = Readable.fromWeb(response.body as any);
  nodeStream.on('data', (chunk: Buffer) => hash.update(chunk));
  const writeStream = fs.createWriteStream(zipPath);
  await pipeline(nodeStream, writeStream);

  return { zipPath, checksum: hash.digest('hex') };
};

export const extractZip = async (zipPath: string): Promise<string> => {
  const outDir = path.join(path.dirname(zipPath), 'extracted');
  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: outDir })).promise();
  return outDir;
};

export const discoverFiles = async (folder: string, overrideMap?: Record<string, string>) => {
  const files = await fs.promises.readdir(folder);
  const lower = files.map((name) => ({ name, lower: name.toLowerCase() }));

  const organization = lower.find((f) => f.lower === 'organization.txt')?.name;
  const mappedMembership = overrideMap?.membership;

  const membership =
    mappedMembership ??
    lower.find((f) => /member|mbr|membership/.test(f.lower))?.name ??
    (await detectByHeader(folder, files));

  return {
    organization,
    membership,
    fileList: files
  };
};

export const detectByHeader = async (folder: string, files: string[]): Promise<string | undefined> => {
  for (const file of files) {
    const fullPath = path.join(folder, file);
    const text = await fs.promises.readFile(fullPath, 'utf8');
    const firstLine = text.split(/\r?\n/)[0]?.toLowerCase() ?? '';
    if (firstLine.includes('capid') && firstLine.includes('lastname')) {
      return file;
    }
  }
  return undefined;
};

export type ParsedMember = {
  capid: string;
  firstName: string;
  lastName: string;
  memberType: 'CADET' | 'SENIOR' | 'UNKNOWN';
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  email?: string;
  unitCharter?: string;
  orgid?: number;
};

export const parseMembershipText = (text: string): ParsedMember[] => {
  const [header, ...rows] = text.split(/\r?\n/).filter(Boolean);
  const columns = header.split('|').map((h) => h.trim().toLowerCase());
  const index = (name: string) => columns.findIndex((c) => c === name);

  return rows.map((row) => {
    const parts = row.split('|').map((p) => p.trim());
    const typeRaw = parts[index('membertype')]?.toUpperCase() ?? '';
    const statusRaw = parts[index('status')]?.toUpperCase() ?? '';
    return {
      capid: parts[index('capid')] ?? '',
      firstName: parts[index('firstname')] ?? '',
      lastName: parts[index('lastname')] ?? '',
      memberType: typeRaw.includes('CADET') ? 'CADET' : typeRaw.includes('SENIOR') ? 'SENIOR' : 'UNKNOWN',
      status: statusRaw.includes('ACTIVE') ? 'ACTIVE' : statusRaw.includes('INACTIVE') ? 'INACTIVE' : 'UNKNOWN',
      email: parts[index('email')] || undefined,
      unitCharter: parts[index('unitcharter')] || undefined,
      orgid: Number(parts[index('orgid')]) || undefined
    };
  });
};
