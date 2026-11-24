/**
 * Volunteer DTOs for Vashundhara Foundation API
 */

import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { extendApi } from '@anatine/zod-openapi';

// ============================================
// Volunteer DTOs
// ============================================

const VolunteerBaseSchema = z.object({
  userId: z.string().uuid().optional().openapi({ example: 'user-uuid' }),
  firstName: z.string().min(1).max(100).openapi({ example: 'Jane' }),
  lastName: z.string().min(1).max(100).openapi({ example: 'Smith' }),
  email: z.string().email().openapi({ example: 'jane.smith@example.com' }),
  phone: z.string().optional().openapi({ example: '+91-9876543210' }),
  mobile: z.string().optional().openapi({ example: '+91-9876543210' }),
  whatsapp: z.string().optional().openapi({ example: '+91-9876543210' }),
  dateOfBirth: z.date().optional().openapi({ example: '1995-06-15T00:00:00Z' }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional()
  }).optional(),
  emergencyContact: z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
    email: z.string().email().optional()
  }).optional(),
  occupation: z.string().optional().openapi({ example: 'Software Engineer' }),
  employer: z.string().optional().openapi({ example: 'Tech Corp' }),
  education: z.string().optional().openapi({ example: 'Bachelor of Technology' }),
  skills: z.array(z.string()).default([]).optional(),
  interests: z.array(z.string()).default([]).optional(),
  languages: z.array(z.string()).default([]).optional(),
  availability: z.object({
    weekdays: z.array(z.string()).optional(),
    weekends: z.array(z.string()).optional(),
    hoursPerWeek: z.number().int().positive().optional(),
    preferredTimes: z.array(z.string()).optional()
  }).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_HOLD', 'BLACKLISTED', 'ALUMNI']).default('ACTIVE').optional(),
  joinDate: z.date().optional().openapi({ example: '2024-01-15T00:00:00Z' }),
  source: z.string().optional().openapi({ example: 'website' }),
  referralSource: z.string().optional(),
  tags: z.array(z.string()).default([]).optional(),
  notes: z.string().optional(),
  documents: z.array(z.object({
    type: z.string(),
    name: z.string(),
    url: z.string().url(),
    uploadedAt: z.date()
  })).default([]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateVolunteerSchema = VolunteerBaseSchema;
export class CreateVolunteerDto extends createZodDto(extendApi(CreateVolunteerSchema)) {}

export const UpdateVolunteerSchema = VolunteerBaseSchema.partial();
export class UpdateVolunteerDto extends createZodDto(extendApi(UpdateVolunteerSchema)) {}

export const VolunteerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  skills: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class VolunteerQueryDto extends createZodDto(extendApi(VolunteerQuerySchema)) {}

export const VolunteerResponseSchema = VolunteerBaseSchema.extend({
  id: z.string().uuid(),
  fullName: z.string(),
  totalHours: z.number().default(0),
  totalShifts: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class VolunteerResponseDto extends createZodDto(extendApi(VolunteerResponseSchema)) {}

// ============================================
// Shift DTOs
// ============================================

const ShiftBaseSchema = z.object({
  title: z.string().min(1).max(255).openapi({ example: 'Food Distribution Drive' }),
  description: z.string().optional(),
  location: z.string().optional().openapi({ example: 'Community Center, Mumbai' }),
  startDateTime: z.date().openapi({ example: '2024-12-20T09:00:00Z' }),
  endDateTime: z.date().openapi({ example: '2024-12-20T17:00:00Z' }),
  timezone: z.string().default('Asia/Kolkata').optional(),
  maxVolunteers: z.number().int().positive().default(10).optional(),
  requiredSkills: z.array(z.string()).default([]).optional(),
  requiredRoles: z.array(z.string()).default([]).optional(),
  isRecurring: z.boolean().default(false).optional(),
  recurrenceRule: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'FULL', 'CANCELLED', 'COMPLETED']).default('DRAFT').optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  tags: z.array(z.string()).default([]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateShiftSchema = ShiftBaseSchema;
export class CreateShiftDto extends createZodDto(extendApi(CreateShiftSchema)) {}

export const UpdateShiftSchema = ShiftBaseSchema.partial();
export class UpdateShiftDto extends createZodDto(extendApi(UpdateShiftSchema)) {}

export const ShiftQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  location: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
});
export class ShiftQueryDto extends createZodDto(extendApi(ShiftQuerySchema)) {}

export const ShiftResponseSchema = ShiftBaseSchema.extend({
  id: z.string().uuid(),
  currentVolunteers: z.number().default(0),
  waitlistCount: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class ShiftResponseDto extends createZodDto(extendApi(ShiftResponseSchema)) {}

// ============================================
// ShiftAssignment DTOs
// ============================================

const ShiftAssignmentBaseSchema = z.object({
  shiftId: z.string().uuid().openapi({ example: 'shift-uuid' }),
  volunteerId: z.string().uuid().openapi({ example: 'volunteer-uuid' }),
  status: z.enum(['REGISTERED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'WAITLISTED']).default('REGISTERED').optional(),
  role: z.string().optional(),
  checkInTime: z.date().nullable().optional(),
  checkOutTime: z.date().nullable().optional(),
  hoursCredited: z.number().nonnegative().default(0).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateShiftAssignmentSchema = ShiftAssignmentBaseSchema;
export class CreateShiftAssignmentDto extends createZodDto(extendApi(CreateShiftAssignmentSchema)) {}

export const UpdateShiftAssignmentSchema = ShiftAssignmentBaseSchema.partial();
export class UpdateShiftAssignmentDto extends createZodDto(extendApi(UpdateShiftAssignmentSchema)) {}

export const ShiftAssignmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  shiftId: z.string().uuid().optional(),
  volunteerId: z.string().uuid().optional(),
  status: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class ShiftAssignmentQueryDto extends createZodDto(extendApi(ShiftAssignmentQuerySchema)) {}

export const ShiftAssignmentResponseSchema = ShiftAssignmentBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class ShiftAssignmentResponseDto extends createZodDto(extendApi(ShiftAssignmentResponseSchema)) {}

// ============================================
// Skill DTOs
// ============================================

const SkillBaseSchema = z.object({
  name: z.string().min(1).max(100).openapi({ example: 'First Aid' }),
  category: z.string().optional().openapi({ example: 'Medical' }),
  description: z.string().optional(),
  isCertifiable: z.boolean().default(false).optional(),
  certificationUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateSkillSchema = SkillBaseSchema;
export class CreateSkillDto extends createZodDto(extendApi(CreateSkillSchema)) {}

export const UpdateSkillSchema = SkillBaseSchema.partial();
export class UpdateSkillDto extends createZodDto(extendApi(UpdateSkillSchema)) {}

export const SkillResponseSchema = SkillBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class SkillResponseDto extends createZodDto(extendApi(SkillResponseSchema)) {}

// ============================================
// VolunteerSkill DTOs
// ============================================

const VolunteerSkillBaseSchema = z.object({
  volunteerId: z.string().uuid().openapi({ example: 'volunteer-uuid' }),
  skillId: z.string().uuid().openapi({ example: 'skill-uuid' }),
  proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('BEGINNER').optional(),
  certified: z.boolean().default(false).optional(),
  certifiedAt: z.date().nullable().optional(),
  certificationUrl: z.string().url().nullable().optional(),
  verifiedBy: z.string().uuid().nullable().optional(),
  verifiedAt: z.date().nullable().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateVolunteerSkillSchema = VolunteerSkillBaseSchema;
export class CreateVolunteerSkillDto extends createZodDto(extendApi(CreateVolunteerSkillSchema)) {}

export const UpdateVolunteerSkillSchema = VolunteerSkillBaseSchema.partial();
export class UpdateVolunteerSkillDto extends createZodDto(extendApi(UpdateVolunteerSkillSchema)) {}

export const VolunteerSkillResponseSchema = VolunteerSkillBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export class VolunteerSkillResponseDto extends createZodDto(extendApi(VolunteerSkillResponseSchema)) {}

// ============================================
// HoursLog DTOs
// ============================================

const HoursLogBaseSchema = z.object({
  volunteerId: z.string().uuid().openapi({ example: 'volunteer-uuid' }),
  shiftId: z.string().uuid().optional().openapi({ example: 'shift-uuid' }),
  date: z.date().openapi({ example: '2024-12-20T00:00:00Z' }),
  hours: z.number().positive().openapi({ example: 8 }),
  description: z.string().optional(),
  activityType: z.enum(['SHIFT', 'TRAINING', 'MEETING', 'ADMIN', 'OUTREACH', 'FUNDRAISING', 'OTHER']).default('SHIFT').optional(),
  location: z.string().optional(),
  verifiedBy: z.string().uuid().nullable().optional(),
  verifiedAt: z.date().nullable().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').optional(),
  tags: z.array(z.string()).default([]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateHoursLogSchema = HoursLogBaseSchema;
export class CreateHoursLogDto extends createZodDto(extendApi(CreateHoursLogSchema)) {}

export const UpdateHoursLogSchema = HoursLogBaseSchema.partial();
export class UpdateHoursLogDto extends createZodDto(extendApi(UpdateHoursLogSchema)) {}

export const HoursLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  volunteerId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  status: z.string().optional(),
  activityType: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class HoursLogQueryDto extends createZodDto(extendApi(HoursLogQuerySchema)) {}

export const HoursLogResponseSchema = HoursLogBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class HoursLogResponseDto extends createZodDto(extendApi(HoursLogResponseSchema)) {}

// ============================================
// Availability DTOs
// ============================================

const AvailabilityBaseSchema = z.object({
  volunteerId: z.string().uuid().openapi({ example: 'volunteer-uuid' }),
  dayOfWeek: z.number().int().min(0).max(6).openapi({ example: 1 }),
  startTime: z.string().openapi({ example: '09:00' }),
  endTime: z.string().openapi({ example: '17:00' }),
  timezone: z.string().default('Asia/Kolkata').optional(),
  isRecurring: z.boolean().default(true).optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().nullable().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateAvailabilitySchema = AvailabilityBaseSchema;
export class CreateAvailabilityDto extends createZodDto(extendApi(CreateAvailabilitySchema)) {}

export const UpdateAvailabilitySchema = AvailabilityBaseSchema.partial();
export class UpdateAvailabilityDto extends createZodDto(extendApi(UpdateAvailabilitySchema)) {}

export const AvailabilityResponseSchema = AvailabilityBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional()
});
export class AvailabilityResponseDto extends createZodDto(extendApi(AvailabilityResponseSchema)) {}

// ============================================
// Dashboard / Stats DTOs
// ============================================

export const VolunteerStatsSchema = z.object({
  totalVolunteers: z.number(),
  activeVolunteers: z.number(),
  newThisMonth: z.number(),
  totalHours: z.number(),
  hoursThisMonth: z.number(),
  totalShifts: z.number(),
  upcomingShifts: z.number(),
  volunteersByStatus: z.array(z.object({
    status: z.string(),
    count: z.number()
  })),
  topVolunteers: z.array(z.object({
    volunteerId: z.string(),
    fullName: z.string(),
    totalHours: z.number()
  })),
  upcomingShiftsList: z.array(z.object({
    id: z.string(),
    title: z.string(),
    startDateTime: z.date(),
    currentVolunteers: z.number(),
    maxVolunteers: z.number()
  }))
});
export class VolunteerStatsDto extends createZodDto(extendApi(VolunteerStatsSchema)) {}