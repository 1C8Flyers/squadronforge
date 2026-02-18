import { NextFunction, Request, Response } from 'express';
import { AccessTokenPayload, getAuthPayload } from '../lib/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.auth = getAuthPayload(req);
    next();
  } catch {
    throw new Error('Unauthorized');
  }
};
