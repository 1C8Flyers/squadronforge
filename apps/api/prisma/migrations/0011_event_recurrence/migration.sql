CREATE TYPE "RecurrenceFrequency" AS ENUM ('none', 'daily', 'weekly', 'monthly');

ALTER TABLE "Event"
ADD COLUMN "recurrenceSeriesId" TEXT,
ADD COLUMN "recurrenceFrequency" "RecurrenceFrequency" NOT NULL DEFAULT 'none',
ADD COLUMN "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "recurrenceUntil" TIMESTAMP(3);

CREATE INDEX "Event_tenantId_recurrenceSeriesId_idx" ON "Event"("tenantId", "recurrenceSeriesId");
