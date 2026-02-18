import { NextFunction, Request, Response } from 'express';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(JSON.stringify({ level: 'error', msg: message }));

  if (/unauthorized|invalid credentials|missing auth header/i.test(message)) {
    return res.status(401).json({ error: message });
  }
  if (/denied|required/i.test(message)) {
    return res.status(403).json({ error: message });
  }
  if (/not found/i.test(message)) {
    return res.status(404).json({ error: message });
  }

  return res.status(400).json({ error: message });
};
