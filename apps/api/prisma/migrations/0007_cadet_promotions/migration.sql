CREATE TABLE "CadetPromotion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capid" TEXT NOT NULL,
    "memberName" TEXT,
    "rank" TEXT,
    "achievementName" TEXT,
    "datePromotionEligible" TIMESTAMP(3),
    "lastPtDate" TIMESTAMP(3),
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "leadershipTestCompleted" BOOLEAN NOT NULL DEFAULT false,
    "leadershipModuleCompleted" BOOLEAN NOT NULL DEFAULT false,
    "aeTestCompleted" BOOLEAN,
    "aeModuleCompleted" BOOLEAN,
    "chiefSpeechEssayCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sdaCompleted" BOOLEAN NOT NULL DEFAULT false,
    "ptStatus" TEXT,
    "leadStatus" TEXT,
    "aeStatus" TEXT,
    "drillStatus" TEXT,
    "cdStatus" TEXT,
    "sdaStatus" TEXT,
    "comments" TEXT,
    "sourceRow" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadetPromotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CadetPromotion_tenantId_capid_key" ON "CadetPromotion"("tenantId", "capid");
CREATE INDEX "CadetPromotion_tenantId_ready_idx" ON "CadetPromotion"("tenantId", "ready");
CREATE INDEX "CadetPromotion_tenantId_inactive_idx" ON "CadetPromotion"("tenantId", "inactive");

ALTER TABLE "CadetPromotion" ADD CONSTRAINT "CadetPromotion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
