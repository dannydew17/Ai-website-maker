-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "osmId" TEXT NOT NULL,
    "osmType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "phone" TEXT,
    "openingHours" TEXT,
    "existingWebsite" TEXT,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "stage" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "lastError" TEXT,
    "failedAtStage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score" INTEGER,
    "scoreBreakdown" JSONB,
    "scoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Qualification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapedContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "aboutText" TEXT,
    "services" JSONB,
    "photos" JSONB,
    "testimonials" JSONB,
    "contactEmail" TEXT,
    "robotsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapedContent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "buildOutputPath" TEXT NOT NULL,
    "deployUrl" TEXT,
    "vercelDeploymentId" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedAt" DATETIME,
    CONSTRAINT "GeneratedSite_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "editedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "emailDraftId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "domain" TEXT,
    "reason" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_osmId_key" ON "Lead"("osmId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_category_city_idx" ON "Lead"("category", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_leadId_key" ON "Qualification"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedContent_leadId_key" ON "ScrapedContent"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedSite_leadId_key" ON "GeneratedSite"("leadId");

-- CreateIndex
CREATE INDEX "EmailDraft_leadId_createdAt_idx" ON "EmailDraft"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_email_key" ON "SuppressionEntry"("email");

-- CreateIndex
CREATE INDEX "SuppressionEntry_domain_idx" ON "SuppressionEntry"("domain");

-- CreateIndex
CREATE INDEX "StageEvent_leadId_createdAt_idx" ON "StageEvent"("leadId", "createdAt");
