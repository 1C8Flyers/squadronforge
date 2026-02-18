import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../lib/prisma.js';

export const tenantsRouter = Router();
tenantsRouter.use(requireAuth);

tenantsRouter.get('/', async (req, res) => {
  if (req.auth!.systemRole === 'systemAdmin') {
    const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
    return res.json(tenants);
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      users: {
        some: {
          userId: req.auth!.userId
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  return res.json(tenants);
});
