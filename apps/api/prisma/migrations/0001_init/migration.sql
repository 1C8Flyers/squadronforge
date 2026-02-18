CREATE TYPE "SystemRole" AS ENUM ('systemAdmin', 'user');
CREATE TYPE "TenantRole" AS ENUM ('tenantAdmin', 'tenantViewer');
CREATE TYPE "SyncRunStatus" AS ENUM ('success', 'failed', 'running');
CREATE TYPE "MemberType" AS ENUM ('CADET', 'SENIOR', 'UNKNOWN');
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNKNOWN');

CREATE TABLE "Tenant" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "orgid" INTEGER NOT NULL,
  "unitOnly" BOOLEAN NOT NULL DEFAULT TRUE,
  "timezone" TEXT NOT NULL,
  "syncScheduleCron" TEXT NOT NULL,
  "credentialsRef" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "systemRole" "SystemRole" NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TenantUser" (
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL,
  PRIMARY KEY ("tenantId", "userId")
);

CREATE TABLE "SyncRun" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "status" "SyncRunStatus" NOT NULL,
  "membersUpserted" INTEGER NOT NULL DEFAULT 0,
  "membersActive" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "fileListJson" JSONB,
  "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Member" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "capid" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "memberType" "MemberType" NOT NULL DEFAULT 'UNKNOWN',
  "email" TEXT,
  "status" "MemberStatus" NOT NULL DEFAULT 'UNKNOWN',
  "unitCharter" TEXT,
  "orgid" INTEGER,
  "expirationDate" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Member_tenantId_capid_key" ON "Member"("tenantId", "capid");
CREATE INDEX "Member_tenantId_lastName_idx" ON "Member"("tenantId", "lastName");

ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
