/**
 * CRM DTOs for Vashundhara Foundation API
 */

import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { extendApi } from '@anatine/zod-openapi';

// ============================================
// Contact DTOs
// ============================================

const ContactBaseSchema = z.object({
  firstName: z.string().min(1).max(100).openapi({ example: 'John' }),
  lastName: z.string().min(1).max(100).openapi({ example: 'Doe' }),
  email: z.string().email().optional().openapi({ example: 'john.doe@example.com' }),
  phone: z.string().optional().openapi({ example: '+91-9876543210' }),
  mobile: z.string().optional().openapi({ example: '+91-9876543210' }),
  whatsapp: z.string().optional().openapi({ example: '+91-9876543210' }),
  jobTitle: z.string().optional().openapi({ example: 'CTO' }),
  department: z.string().optional().openapi({ example: 'Engineering' }),
  organizationId: z.string().uuid().optional().openapi({ example: 'org-uuid' }),
  source: z.string().optional().openapi({ example: 'website' }),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).default('NEW').optional(),
  leadScore: z.number().int().min(0).max(100).default(0).optional(),
  tags: z.array(z.string()).default([]).optional(),
  notes: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional()
  }).optional(),
  socialLinks: z.object({
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
    facebook: z.string().url().optional()
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateContactSchema = ContactBaseSchema;
export class CreateContactDto extends createZodDto(extendApi(CreateContactSchema)) {}

export const UpdateContactSchema = ContactBaseSchema.partial();
export class UpdateContactDto extends createZodDto(extendApi(UpdateContactSchema)) {}

export const ContactQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class ContactQueryDto extends createZodDto(extendApi(ContactQuerySchema)) {}

export const ContactResponseSchema = ContactBaseSchema.extend({
  id: z.string().uuid(),
  fullName: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional(),
  lastContactedAt: z.date().nullable().optional()
});
export class ContactResponseDto extends createZodDto(extendApi(ContactResponseSchema)) {}

// ============================================
// Organization DTOs
// ============================================

const OrganizationBaseSchema = z.object({
  name: z.string().min(1).max(255).openapi({ example: 'Acme Corporation' }),
  legalName: z.string().optional().openapi({ example: 'Acme Corp Pvt Ltd' }),
  website: z.string().url().optional().openapi({ example: 'https://acme.com' }),
  industry: z.string().optional().openapi({ example: 'Technology' }),
  size: z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  revenue: z.number().optional().openapi({ example: 5000000 }),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional()
  }).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  gstNumber: z.string().optional().openapi({ example: '27ABCDE1234F1Z5' }),
  panNumber: z.string().optional().openapi({ example: 'ABCDE1234F' }),
  tags: z.array(z.string()).default([]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateOrganizationSchema = OrganizationBaseSchema;
export class CreateOrganizationDto extends createZodDto(extendApi(CreateOrganizationSchema)) {}

export const UpdateOrganizationSchema = OrganizationBaseSchema.partial();
export class UpdateOrganizationDto extends createZodDto(extendApi(UpdateOrganizationSchema)) {}

export const OrganizationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class OrganizationQueryDto extends createZodDto(extendApi(OrganizationQuerySchema)) {}

export const OrganizationResponseSchema = OrganizationBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional(),
  contactCount: z.number().optional()
});
export class OrganizationResponseDto extends createZodDto(extendApi(OrganizationResponseSchema)) {}

// ============================================
// Deal/Pipeline DTOs
// ============================================

const PipelineBaseSchema = z.object({
  name: z.string().min(1).max(100).openapi({ example: 'Sales Pipeline' }),
  description: z.string().optional(),
  isDefault: z.boolean().default(false).optional(),
  stages: z.array(z.object({
    name: z.string(),
    order: z.number().int(),
    probability: z.number().int().min(0).max(100),
    color: z.string().optional()
  })).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreatePipelineSchema = PipelineBaseSchema;
export class CreatePipelineDto extends createZodDto(extendApi(CreatePipelineSchema)) {}

export const UpdatePipelineSchema = PipelineBaseSchema.partial();
export class UpdatePipelineDto extends createZodDto(extendApi(UpdatePipelineSchema)) {}

const DealBaseSchema = z.object({
  title: z.string().min(1).max(255).openapi({ example: 'Enterprise License Deal' }),
  description: z.string().optional(),
  value: z.number().positive().openapi({ example: 500000 }),
  currency: z.string().default('INR').optional(),
  pipelineId: z.string().uuid().openapi({ example: 'pipeline-uuid' }),
  stageId: z.string().uuid().openapi({ example: 'stage-uuid' }),
  contactId: z.string().uuid().optional().openapi({ example: 'contact-uuid' }),
  organizationId: z.string().uuid().optional().openapi({ example: 'org-uuid' }),
  assignedTo: z.string().uuid().optional().openapi({ example: 'user-uuid' }),
  expectedCloseDate: z.date().optional().openapi({ example: '2024-12-31T00:00:00Z' }),
  probability: z.number().int().min(0).max(100).default(10).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateDealSchema = DealBaseSchema;
export class CreateDealDto extends createZodDto(extendApi(CreateDealSchema)) {}

export const UpdateDealSchema = DealBaseSchema.partial();
export class UpdateDealDto extends createZodDto(extendApi(UpdateDealSchema)) {}

export const DealQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  expectedCloseFrom: z.coerce.date().optional(),
  expectedCloseTo: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class DealQueryDto extends createZodDto(extendApi(DealQuerySchema)) {}

export const DealResponseSchema = DealBaseSchema.extend({
  id: z.string().uuid(),
  actualCloseDate: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class DealResponseDto extends createZodDto(extendApi(DealResponseSchema)) {}

// ============================================
// Activity DTOs (CRM-specific activities)
// ============================================

const CrmActivityBaseSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'WHATSAPP', 'LINKEDIN']).openapi({ example: 'CALL' }),
  subject: z.string().min(1).max(255).openapi({ example: 'Follow up call' }),
  description: z.string().optional(),
  contactId: z.string().uuid().optional().openapi({ example: 'contact-uuid' }),
  dealId: z.string().uuid().optional().openapi({ example: 'deal-uuid' }),
  organizationId: z.string().uuid().optional().openapi({ example: 'org-uuid' }),
  dueDate: z.date().optional(),
  completedAt: z.date().nullable().optional(),
  duration: z.number().int().optional().openapi({ example: 30 }),
  outcome: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateCrmActivitySchema = CrmActivityBaseSchema;
export class CreateCrmActivityDto extends createZodDto(extendApi(CreateCrmActivitySchema)) {}

export const UpdateCrmActivitySchema = CrmActivityBaseSchema.partial();
export class UpdateCrmActivityDto extends createZodDto(extendApi(UpdateCrmActivitySchema)) {}

export const CrmActivityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  type: z.string().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  completed: z.coerce.boolean().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class CrmActivityQueryDto extends createZodDto(extendApi(CrmActivityQuerySchema)) {}

export const CrmActivityResponseSchema = CrmActivityBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class CrmActivityResponseDto extends createZodDto(extendApi(CrmActivityResponseSchema)) {}