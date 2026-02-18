import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      systemRole: 'systemAdmin'
    }
  });

  const rockford = await prisma.tenant.upsert({
    where: { slug: 'rockford' },
    update: {},
    create: {
      name: 'Rockford Composite Squadron',
      slug: 'rockford',
      orgid: 1092,
      unitOnly: true,
      timezone: 'America/Chicago',
      syncScheduleCron: '0 */4 * * *',
      credentialsRef: 'rockford',
      isEnabled: true
    }
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: rockford.id, userId: admin.id } },
    update: {},
    create: {
      tenantId: rockford.id,
      userId: admin.id,
      role: 'tenantAdmin'
    }
  });

  console.log(JSON.stringify({ level: 'info', msg: 'seed_complete', admin: email, tenant: 'rockford' }));
}

main().finally(async () => {
  await prisma.$disconnect();
});
