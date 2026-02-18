import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAuthPayload
} from '../src/lib/auth.js';

describe('auth token utilities', () => {
  it('signs and verifies access token', () => {
    const token = signAccessToken({ userId: 'u1', systemRole: 'systemAdmin' });
    const payload = verifyAccessToken(token);

    expect(payload.userId).toBe('u1');
    expect(payload.systemRole).toBe('systemAdmin');
  });

  it('signs and verifies refresh token', () => {
    const token = signRefreshToken({ userId: 'u1', tokenId: 'rt1' });
    const payload = verifyRefreshToken(token);

    expect(payload.userId).toBe('u1');
    expect(payload.tokenId).toBe('rt1');
  });

  it('extracts auth payload from bearer header', () => {
    const token = signAccessToken({ userId: 'u2', systemRole: 'user' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const payload = getAuthPayload(req);

    expect(payload.userId).toBe('u2');
    expect(payload.systemRole).toBe('user');
  });

  it('throws when auth header is missing', () => {
    const req = { headers: {} } as Request;
    expect(() => getAuthPayload(req)).toThrow('Missing auth header');
  });
});
