import { describe, expect, it } from 'vitest';
import { detectByHeader, parseMembershipText } from '../src/lib/capwatch.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('capwatch parser', () => {
  it('detects membership file by header', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cw-test-'));
    await fs.writeFile(path.join(dir, 'foo.txt'), 'hello|world');
    await fs.writeFile(path.join(dir, 'mystery.txt'), 'capid|lastname|firstname|status\n1|Doe|Jane|ACTIVE');

    const found = await detectByHeader(dir, ['foo.txt', 'mystery.txt']);
    expect(found).toBe('mystery.txt');
  });

  it('parses sample member row', () => {
    const text = 'capid|lastname|firstname|membertype|status|email|unitcharter|orgid\n123456|Doe|Jane|Cadet|Active|jane@example.com|IL-251|1092';
    const parsed = parseMembershipText(text);
    expect(parsed[0].capid).toBe('123456');
    expect(parsed[0].memberType).toBe('CADET');
    expect(parsed[0].status).toBe('ACTIVE');
    expect(parsed[0].orgid).toBe(1092);
  });
});
