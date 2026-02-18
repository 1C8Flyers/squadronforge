import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../lib/prisma.js';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: {
      id: true,
      email: true,
      systemRole: true,
      createdAt: true,
      tenants: {
        select: {
          role: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }
    }
  });

  return res.json(user);
});
