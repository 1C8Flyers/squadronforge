CREATE TABLE "EventAudienceMember" (
	"id" TEXT PRIMARY KEY,
	"tenantId" TEXT NOT NULL,
	"eventId" TEXT NOT NULL,
	"capid" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EventAudienceMember_tenantId_eventId_capid_key" ON "EventAudienceMember"("tenantId", "eventId", "capid");
CREATE INDEX "EventAudienceMember_tenantId_eventId_idx" ON "EventAudienceMember"("tenantId", "eventId");

ALTER TABLE "EventAudienceMember" ADD CONSTRAINT "EventAudienceMember_tenantId_fkey"
	FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAudienceMember" ADD CONSTRAINT "EventAudienceMember_eventId_fkey"
	FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventExternalRecipient" (
	"id" TEXT PRIMARY KEY,
	"tenantId" TEXT NOT NULL,
	"eventId" TEXT NOT NULL,
	"name" TEXT,
	"email" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EventExternalRecipient_tenantId_eventId_email_key" ON "EventExternalRecipient"("tenantId", "eventId", "email");
CREATE INDEX "EventExternalRecipient_tenantId_eventId_idx" ON "EventExternalRecipient"("tenantId", "eventId");

ALTER TABLE "EventExternalRecipient" ADD CONSTRAINT "EventExternalRecipient_tenantId_fkey"
	FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventExternalRecipient" ADD CONSTRAINT "EventExternalRecipient_eventId_fkey"
	FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventRsvp"
	ADD COLUMN "externalEmail" TEXT,
	ADD COLUMN "externalName" TEXT;

CREATE UNIQUE INDEX "EventRsvp_tenantId_eventId_externalEmail_key" ON "EventRsvp"("tenantId", "eventId", "externalEmail");
