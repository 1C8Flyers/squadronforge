import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../lib/auth.js';
import { requireAuth } from '../middleware/require-auth.js';

export const authRouter = Router();

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const refreshExpiryDate = (): Date => new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.email(), password: z.string().min(6) }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const refreshTokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ userId: user.id, tokenId: refreshTokenId });
  const accessToken = signAccessToken({ userId: user.id, systemRole: user.systemRole });

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiryDate()
    }
  });

  return res.json({
    token: accessToken,
    refreshToken,
    accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresInSeconds: REFRESH_TOKEN_TTL_SECONDS
  });
});

authRouter.post('/refresh', async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);

  let payload;
  try {
    payload = verifyRefreshToken(body.refreshToken);
  } catch {
    throw new Error('Unauthorized');
  }

  const existing = await prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });
  if (!existing) {
    throw new Error('Unauthorized');
  }
  if (existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
    throw new Error('Unauthorized');
  }
  if (existing.tokenHash !== hashToken(body.refreshToken)) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new Error('Unauthorized');
  }

  const nextRefreshTokenId = crypto.randomUUID();
  const nextRefreshToken = signRefreshToken({ userId: user.id, tokenId: nextRefreshTokenId });
  const nextAccessToken = signAccessToken({ userId: user.id, systemRole: user.systemRole });

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: nextRefreshTokenId
      }
    }),
    prisma.refreshToken.create({
      data: {
        id: nextRefreshTokenId,
        userId: user.id,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt: refreshExpiryDate()
      }
    })
  ]);

  return res.json({
    token: nextAccessToken,
    refreshToken: nextRefreshToken,
    accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresInSeconds: REFRESH_TOKEN_TTL_SECONDS
  });
});

authRouter.post('/logout', requireAuth, async (_req, res) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId: _req.auth!.userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
  return res.status(204).send();
});
