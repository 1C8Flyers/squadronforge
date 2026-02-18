import jwt from 'jsonwebtoken';
import { Request } from 'express';

export type AccessTokenPayload = {
  userId: string;
  systemRole: 'systemAdmin' | 'user';
};

export type RefreshTokenPayload = {
  userId: string;
  tokenId: string;
};

const accessSecret = process.env.JWT_SECRET ?? 'dev-secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? `${accessSecret}-refresh`;

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, accessSecret, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, refreshSecret, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, accessSecret) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, refreshSecret) as RefreshTokenPayload;
};

export const getAuthPayload = (req: Request): AccessTokenPayload => {
  const header = req.headers.authorization;
  if (!header) {
    throw new Error('Missing auth header');
  }
  const token = header.replace('Bearer ', '');
  return verifyAccessToken(token);
};
