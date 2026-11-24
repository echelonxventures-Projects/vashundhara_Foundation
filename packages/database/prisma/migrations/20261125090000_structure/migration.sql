-- CreateEnum
CREATE TYPE "StructureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- AlterEnum
ALTER TYPE "WebhookEvent" ADD VALUE 'RECORD_SAVED';

-- CreateTable
CREATE TABLE "structure_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ngoAdminAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxFields" INTEGER NOT NULL DEFAULT 150,
    "maxTables" INTEGER NOT NULL DEFAULT 20,
    "maxForms" INTEGER NOT NULL DEFAULT 20,
    "maxRules" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structure_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" INTEGER,
    "status" "StructureStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structure_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'STAFF',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structure_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "structure_policies_tenantId_key" ON "structure_policies"("tenantId");

-- CreateIndex
CREATE INDEX "structure_versions_tenantId_status_idx" ON "structure_versions"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "structure_versions_tenantId_number_key" ON "structure_versions"("tenantId", "number");

-- CreateIndex
CREATE INDEX "custom_values_data_idx" ON "custom_values" USING GIN ("data" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "custom_values_tenantId_entity_recordId_key" ON "custom_values"("tenantId", "entity", "recordId");

-- CreateIndex
CREATE INDEX "custom_records_tenantId_tableKey_createdAt_idx" ON "custom_records"("tenantId", "tableKey", "createdAt");

-- CreateIndex
CREATE INDEX "custom_records_data_idx" ON "custom_records" USING GIN ("data" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "structure_templates_name_key" ON "structure_templates"("name");

-- AddForeignKey
ALTER TABLE "structure_policies" ADD CONSTRAINT "structure_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_versions" ADD CONSTRAINT "structure_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_values" ADD CONSTRAINT "custom_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_records" ADD CONSTRAINT "custom_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one draft and one live structure per NGO.
CREATE UNIQUE INDEX "structure_one_draft" ON "structure_versions" ("tenantId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "structure_one_published" ON "structure_versions" ("tenantId") WHERE "status" = 'PUBLISHED';
CREATE UNIQUE INDEX "structure_one_default_template" ON "structure_templates" ("isDefault") WHERE "isDefault";

-- Values only ever hold a JSON object.
ALTER TABLE "custom_values" ADD CONSTRAINT "custom_values_object" CHECK (jsonb_typeof("data") = 'object');
ALTER TABLE "custom_records" ADD CONSTRAINT "custom_records_object" CHECK (jsonb_typeof("data") = 'object');

CALL install_tenant_checks();
