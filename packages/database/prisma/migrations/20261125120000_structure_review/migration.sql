-- Super Admin approves each publish unless direct publishing is turned on for the NGO.
ALTER TABLE "structure_policies" ADD COLUMN "ngoAdminPublish" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "structure_versions" ADD COLUMN "submittedAt" TIMESTAMP(3), ADD COLUMN "submittedById" TEXT, ADD COLUMN "submitNote" TEXT, ADD COLUMN "reviewNote" TEXT;
CREATE INDEX "structure_waiting" ON "structure_versions" ("submittedAt") WHERE "status" = 'DRAFT' AND "submittedAt" IS NOT NULL;
