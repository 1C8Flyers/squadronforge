CREATE TABLE "MemberContact" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "capid" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "priority" TEXT,
  "contact" TEXT NOT NULL,
  "doNotContact" BOOLEAN NOT NULL DEFAULT false,
  "contactName" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MemberAddress" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "capid" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "priority" TEXT,
  "addr1" TEXT,
  "addr2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "latitude" TEXT,
  "longitude" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberAddress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberContact_tenantId_capid_idx" ON "MemberContact"("tenantId", "capid");
CREATE INDEX "MemberContact_tenantId_type_idx" ON "MemberContact"("tenantId", "type");

CREATE INDEX "MemberAddress_tenantId_capid_idx" ON "MemberAddress"("tenantId", "capid");
CREATE INDEX "MemberAddress_tenantId_type_idx" ON "MemberAddress"("tenantId", "type");
