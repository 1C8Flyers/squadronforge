import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../lib/prisma.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.use((req, _res, next) => {
  if (req.auth?.systemRole !== 'systemAdmin') {
    throw new Error('System admin required');
  }
  next();
});

adminRouter.get('/tenants', async (_req, res) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: 'asc' },
    include: {
      users: {
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      }
    }
  });
  res.json(tenants);
});

adminRouter.post('/tenants', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      slug: z.string().min(2),
      orgid: z.number().int(),
      unitOnly: z.boolean(),
      timezone: z.string(),
      syncScheduleCron: z.string(),
      credentialsRef: z.string().min(1),
      fileMappingJson: z.record(z.string(), z.string()).optional()
    })
    .parse(req.body);

  const created = await prisma.tenant.create({ data: body });
  res.status(201).json(created);
});

adminRouter.patch('/tenants/:id', async (req, res) => {
  const body = z
    .object({
      name: z.string().optional(),
      orgid: z.number().int().optional(),
      unitOnly: z.boolean().optional(),
      timezone: z.string().optional(),
      syncScheduleCron: z.string().optional(),
      isEnabled: z.boolean().optional(),
      credentialsRef: z.string().optional(),
      fileMappingJson: z.record(z.string(), z.string()).optional()
    })
    .parse(req.body);
  const updated = await prisma.tenant.update({ where: { id: req.params.id }, data: body });
  res.json(updated);
});

adminRouter.delete('/tenants/:id', async (req, res) => {
  await prisma.tenant.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

adminRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
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
  res.json(users);
});

adminRouter.post('/users', async (req, res) => {
  const body = z
    .object({
      email: z.email(),
      password: z.string().min(8),
      systemRole: z.enum(['systemAdmin', 'user']).default('user')
    })
    .parse(req.body);

  const passwordHash = await bcrypt.hash(body.password, 12);
  const created = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      systemRole: body.systemRole
    },
    select: {
      id: true,
      email: true,
      systemRole: true,
      createdAt: true
    }
  });
  res.status(201).json(created);
});

adminRouter.patch('/users/:id', async (req, res) => {
  const body = z
    .object({
      email: z.email().optional(),
      password: z.string().min(8).optional(),
      systemRole: z.enum(['systemAdmin', 'user']).optional()
    })
    .parse(req.body);

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(body.email ? { email: body.email } : {}),
      ...(body.systemRole ? { systemRole: body.systemRole } : {}),
      ...(body.password ? { passwordHash: await bcrypt.hash(body.password, 12) } : {})
    },
    select: {
      id: true,
      email: true,
      systemRole: true,
      createdAt: true
    }
  });

  res.json(updated);
});

adminRouter.delete('/users/:id', async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

adminRouter.post('/tenant-users', async (req, res) => {
  const body = z
    .object({
      tenantId: z.string().min(1),
      userId: z.string().min(1),
      role: z.enum(['tenantAdmin', 'tenantViewer'])
    })
    .parse(req.body);

  const assignment = await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: body.tenantId,
        userId: body.userId
      }
    },
    update: {
      role: body.role
    },
    create: body
  });

  res.status(201).json(assignment);
});

adminRouter.delete('/tenant-users', async (req, res) => {
  const body = z
    .object({
      tenantId: z.string().min(1),
      userId: z.string().min(1)
    })
    .parse(req.body);

  await prisma.tenantUser.delete({
    where: {
      tenantId_userId: {
        tenantId: body.tenantId,
        userId: body.userId
      }
    }
  });

  res.status(204).send();
});
