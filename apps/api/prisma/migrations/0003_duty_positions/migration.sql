CREATE TABLE "DutyPosition" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "capid" TEXT NOT NULL,
  "dutyName" TEXT NOT NULL,
  "dutyCode" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DutyPosition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DutyPosition_tenantId_capid_idx" ON "DutyPosition"("tenantId", "capid");
CREATE INDEX "DutyPosition_tenantId_dutyCode_idx" ON "DutyPosition"("tenantId", "dutyCode");
