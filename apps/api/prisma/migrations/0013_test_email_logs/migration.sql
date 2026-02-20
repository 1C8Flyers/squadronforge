CREATE TABLE "TestEmailLog" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "requestedByUserId" TEXT,
  "jobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "TestEmailLog_tenantId_createdAt_idx" ON "TestEmailLog"("tenantId", "createdAt");
CREATE INDEX "TestEmailLog_tenantId_status_idx" ON "TestEmailLog"("tenantId", "status");

ALTER TABLE "TestEmailLog" ADD CONSTRAINT "TestEmailLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
