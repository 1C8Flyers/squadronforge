CREATE TYPE "EventVisibility" AS ENUM ('tenant', 'audience');
CREATE TYPE "RsvpStatus" AS ENUM ('yes', 'no', 'maybe');
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'push');
CREATE TYPE "NotificationType" AS ENUM ('publish', 'update', 'reminder', 'cancel');
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed', 'skipped');

CREATE TABLE "Event" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT FALSE,
  "visibility" "EventVisibility" NOT NULL DEFAULT 'tenant',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "isCancelled" BOOLEAN NOT NULL DEFAULT FALSE,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Event_tenantId_startsAt_idx" ON "Event"("tenantId", "startsAt");
CREATE INDEX "Event_tenantId_isCancelled_startsAt_idx" ON "Event"("tenantId", "isCancelled", "startsAt");

CREATE TABLE "EventAudienceRule" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "memberType" "MemberType",
  "unitCharter" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EventAudienceRule_tenantId_eventId_idx" ON "EventAudienceRule"("tenantId", "eventId");

CREATE TABLE "EventRsvp" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT,
  "capid" TEXT,
  "status" "RsvpStatus" NOT NULL,
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'web',
  "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "EventRsvp_tenantId_eventId_userId_key" ON "EventRsvp"("tenantId", "eventId", "userId");
CREATE INDEX "EventRsvp_tenantId_eventId_status_idx" ON "EventRsvp"("tenantId", "eventId", "status");
CREATE INDEX "EventRsvp_tenantId_capid_idx" ON "EventRsvp"("tenantId", "capid");

CREATE TABLE "EventNotification" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "type" "NotificationType" NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
  "errorMessage" TEXT,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "EventNotification_tenantId_status_scheduledAt_idx" ON "EventNotification"("tenantId", "status", "scheduledAt");
CREATE INDEX "EventNotification_tenantId_eventId_channel_type_idx" ON "EventNotification"("tenantId", "eventId", "channel", "type");

CREATE TABLE "PushSubscription" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PushSubscription_tenantId_userId_endpoint_key" ON "PushSubscription"("tenantId", "userId", "endpoint");
CREATE INDEX "PushSubscription_tenantId_userId_idx" ON "PushSubscription"("tenantId", "userId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventAudienceRule" ADD CONSTRAINT "EventAudienceRule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAudienceRule" ADD CONSTRAINT "EventAudienceRule_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventNotification" ADD CONSTRAINT "EventNotification_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventNotification" ADD CONSTRAINT "EventNotification_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
