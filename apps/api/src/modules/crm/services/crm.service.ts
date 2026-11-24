/**
 * CRM Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// ============================================
// Type Definitions
// ============================================

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;
  jobTitle: string | null;
  department: string | null;
  organizationId: string | null;
  source: string | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
  leadScore: number;
  tags: string[];
  notes: string | null;
  address: Prisma.InputJsonValue | null;
  socialLinks: Prisma.InputJsonValue | null;
  metadata: Prisma.InputJsonValue | null;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  industry: string | null;
  size: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null;
  revenue: number | null;
  description: string | null;
  logoUrl: string | null;
  address: Prisma.InputJsonValue | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  tags: string[];
  metadata: Prisma.InputJsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  stages: Prisma.InputJsonValue;
  metadata: Prisma.InputJsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Deal {
  id: string;
  title: string;
  description: string | null;
  value: number;
  currency: string;
  pipelineId: string;
  stageId: string;
  contactId: string | null;
  organizationId: string | null;
  assignedTo: string | null;
  expectedCloseDate: Date | null;
  actualCloseDate: Date | null;
  probability: number;
  source: string | null;
  tags: string[];
  metadata: Prisma.InputJsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CrmActivity {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK' | 'WHATSAPP' | 'LINKEDIN';
  subject: string;
  description: string | null;
  contactId: string | null;
  dealId: string | null;
  organizationId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  duration: number | null;
  outcome: string | null;
  metadata: Prisma.InputJsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface ContactWhereInput {
  tenantId?: string;
  deletedAt?: null | { not: null };
  email?: string;
  phone?: string;
  mobile?: string;
  status?: string;
  organizationId?: string;
  OR?: Array<Record<string, unknown>>;
}

interface OrganizationWhereInput {
  tenantId?: string;
  deletedAt?: null | { not: null };
  name?: string;
  industry?: string;
  size?: string;
  OR?: Array<Record<string, unknown>>;
}

interface DealWhereInput {
  tenantId?: string;
  deletedAt?: null | { not: null };
  pipelineId?: string;
  stageId?: string;
  contactId?: string;
  organizationId?: string;
  assignedTo?: string;
  value?: { gte?: number; lte?: number };
  expectedCloseDate?: { gte?: Date; lte?: Date };
  OR?: Array<Record<string, unknown>>;
}

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTenantId(): string {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return tenantId;
  }

  // ============================================
  // Contact Methods
  // ============================================

  async findAllContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    organizationId?: string;
    source?: string;
    tags?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const tenantId = this.getTenantId();
    const { page = 1, limit = 20, search, status, organizationId, source, tags, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: ContactWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) where.status = status as any;
    if (organizationId) where.organizationId = organizationId;
    if (source) where.source = source;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          organization: { select: { id: true, name: true } },
          deals: { select: { id: true, title: true, value: true, stageId: true } },
          _count: { select: { deals: true, activities: true } }
        }
      }),
      this.prisma.contact.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findContactById(id: string) {
    const tenantId = this.getTenantId();

    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        organization: true,
        deals: {
          include: {
            pipeline: { select: { id: true, name: true } },
            stage: { select: { id: true, name: true, color: true, probability: true } }
          }
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { deals: true, activities: true } }
      }
    });

    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async createContact(data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    mobile?: string;
    whatsapp?: string;
    jobTitle?: string;
    department?: string;
    organizationId?: string;
    source?: string;
    status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
    leadScore?: number;
    tags?: string[];
    notes?: string;
    address?: Record<string, unknown>;
    socialLinks?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();

    // Check email uniqueness within tenant if provided
    if (data.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { email: data.email.toLowerCase(), tenantId, deletedAt: null }
      });
      if (existing) throw new ConflictException('Contact with this email already exists');
    }

    // Validate organization belongs to tenant
    if (data.organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: data.organizationId, tenantId, deletedAt: null }
      });
      if (!org) throw new BadRequestException('Invalid organization');
    }

    const contact = await this.prisma.contact.create({
      data: {
        ...data,
        email: data.email?.toLowerCase(),
        tenant: { connect: { id: tenantId } },
        organization: data.organizationId ? { connect: { id: data.organizationId } } : undefined,
        address: data.address as Prisma.InputJsonValue,
        socialLinks: data.socialLinks as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue
      },
      include: { organization: { select: { id: true, name: true } } }
    });

    await this.invalidateCache('contact');
    return contact;
  }

  async updateContact(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    mobile: string;
    whatsapp: string;
    jobTitle: string;
    department: string;
    organizationId: string | null;
    source: string;
    status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
    leadScore: number;
    tags: string[];
    notes: string;
    address: Record<string, unknown>;
    socialLinks: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }>) {
    const tenantId = this.getTenantId();
    await this.findContactById(id);

    if (data.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { email: data.email.toLowerCase(), tenantId, deletedAt: null, NOT: { id } }
      });
      if (existing) throw new ConflictException('Contact with this email already exists');
    }

    if (data.organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: data.organizationId, tenantId, deletedAt: null }
      });
      if (!org) throw new BadRequestException('Invalid organization');
    }

    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...data,
        email: data.email?.toLowerCase(),
        address: data.address as Prisma.InputJsonValue | undefined,
        socialLinks: data.socialLinks as Prisma.InputJsonValue | undefined,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      },
      include: { organization: { select: { id: true, name: true } } }
    });

    await this.invalidateCache('contact');
    return contact;
  }

  async deleteContact(id: string) {
    await this.findContactById(id);
    await this.prisma.contact.update({
      where: { id },
      data: { status: 'UNQUALIFIED', deletedAt: new Date() }
    });
    await this.invalidateCache('contact');
    return { success: true };
  }

  // ============================================
  // Organization Methods
  // ============================================

  async findAllOrganizations(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    size?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const tenantId = this.getTenantId();
    const { page = 1, limit = 20, search, industry, size, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: OrganizationWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (industry) where.industry = industry;
    if (size) where.size = size as any;

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { _count: { select: { contacts: true, deals: true } } }
      }),
      this.prisma.organization.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOrganizationById(id: string) {
    const tenantId = this.getTenantId();

    const org = await this.prisma.organization.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        contacts: { take: 10, orderBy: { createdAt: 'desc' } },
        deals: { take: 10, orderBy: { createdAt: 'desc' } },
        _count: { select: { contacts: true, deals: true } }
      }
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async createOrganization(data: {
    name: string;
    legalName?: string;
    website?: string;
    industry?: string;
    size?: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
    revenue?: number;
    description?: string;
    logoUrl?: string;
    address?: Record<string, unknown>;
    phone?: string;
    email?: string;
    gstNumber?: string;
    panNumber?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();

    const org = await this.prisma.organization.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        address: data.address as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue
      }
    });

    await this.invalidateCache('organization');
    return org;
  }

  async updateOrganization(id: string, data: Partial<{
    name: string;
    legalName: string;
    website: string;
    industry: string;
    size: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
    revenue: number;
    description: string;
    logoUrl: string;
    address: Record<string, unknown>;
    phone: string;
    email: string;
    gstNumber: string;
    panNumber: string;
    tags: string[];
    metadata: Record<string, unknown>;
  }>) {
    const tenantId = this.getTenantId();
    await this.findOrganizationById(id);

    const org = await this.prisma.organization.update({
      where: { id },
      data: {
        ...data,
        address: data.address as Prisma.InputJsonValue | undefined,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      }
    });

    await this.invalidateCache('organization');
    return org;
  }

  async deleteOrganization(id: string) {
    await this.findOrganizationById(id);
    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    await this.invalidateCache('organization');
    return { success: true };
  }

  // ============================================
  // Pipeline Methods
  // ============================================

  async findAllPipelines() {
    const tenantId = this.getTenantId();
    return this.prisma.pipeline.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { isDefault: 'desc' }
    });
  }

  async findPipelineById(id: string) {
    const tenantId = this.getTenantId();
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        stages: { orderBy: { order: 'asc' } },
        deals: { where: { deletedAt: null } }
      }
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async createPipeline(data: {
    name: string;
    description?: string;
    isDefault?: boolean;
    stages?: Array<{ name: string; order: number; probability: number; color?: string }>;
    metadata?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();

    if (data.isDefault) {
      await this.prisma.pipeline.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const pipeline = await this.prisma.pipeline.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        stages: data.stages as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue
      },
      include: { stages: { orderBy: { order: 'asc' } } }
    });

    await this.invalidateCache('pipeline');
    return pipeline;
  }

  async updatePipeline(id: string, data: Partial<{
    name: string;
    description: string;
    isDefault: boolean;
    stages: Array<{ name: string; order: number; probability: number; color?: string }>;
    metadata: Record<string, unknown>;
  }>) {
    const tenantId = this.getTenantId();
    await this.findPipelineById(id);

    if (data.isDefault) {
      await this.prisma.pipeline.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false }
      });
    }

    const pipeline = await this.prisma.pipeline.update({
      where: { id },
      data: {
        ...data,
        stages: data.stages as Prisma.InputJsonValue | undefined,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      },
      include: { stages: { orderBy: { order: 'asc' } } }
    });

    await this.invalidateCache('pipeline');
    return pipeline;
  }

  async deletePipeline(id: string) {
    await this.findPipelineById(id);
    const deals = await this.prisma.deal.count({ where: { pipelineId: id, deletedAt: null } });
    if (deals > 0) throw new BadRequestException('Cannot delete pipeline with existing deals');
    await this.prisma.pipeline.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateCache('pipeline');
    return { success: true };
  }

  // ============================================
  // Deal Methods
  // ============================================

  async findAllDeals(params: {
    page?: number;
    limit?: number;
    search?: string;
    pipelineId?: string;
    stageId?: string;
    assignedTo?: string;
    organizationId?: string;
    minValue?: number;
    maxValue?: number;
    expectedCloseFrom?: Date;
    expectedCloseTo?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const tenantId = this.getTenantId();
    const { page = 1, limit = 20, search, pipelineId, stageId, assignedTo, organizationId, minValue, maxValue, expectedCloseFrom, expectedCloseTo, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: DealWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (pipelineId) where.pipelineId = pipelineId;
    if (stageId) where.stageId = stageId;
    if (assignedTo) where.assignedTo = assignedTo;
    if (organizationId) where.organizationId = organizationId;
    if (minValue !== undefined || maxValue !== undefined) {
      where.value = {};
      if (minValue !== undefined) where.value.gte = minValue;
      if (maxValue !== undefined) where.value.lte = maxValue;
    }
    if (expectedCloseFrom || expectedCloseTo) {
      where.expectedCloseDate = {};
      if (expectedCloseFrom) where.expectedCloseDate.gte = expectedCloseFrom;
      if (expectedCloseTo) where.expectedCloseDate.lte = expectedCloseTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, color: true, probability: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          organization: { select: { id: true, name: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      }),
      this.prisma.deal.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findDealById(id: string) {
    const tenantId = this.getTenantId();
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        pipeline: true,
        stage: true,
        contact: true,
        organization: true,
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async createDeal(data: {
    title: string;
    description?: string;
    value: number;
    currency?: string;
    pipelineId: string;
    stageId: string;
    contactId?: string;
    organizationId?: string;
    assignedTo?: string;
    expectedCloseDate?: Date;
    probability?: number;
    source?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();

    // Validate pipeline belongs to tenant
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: data.pipelineId, tenantId, deletedAt: null }
    });
    if (!pipeline) throw new BadRequestException('Invalid pipeline');

    // Validate stage belongs to pipeline
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: data.stageId, pipelineId: data.pipelineId }
    });
    if (!stage) throw new BadRequestException('Invalid stage for pipeline');

    if (data.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: data.contactId, tenantId, deletedAt: null }
      });
      if (!contact) throw new BadRequestException('Invalid contact');
    }

    if (data.organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: data.organizationId, tenantId, deletedAt: null }
      });
      if (!org) throw new BadRequestException('Invalid organization');
    }

    if (data.assignedTo) {
      const user = await this.prisma.user.findFirst({
        where: { id: data.assignedTo, tenantId, deletedAt: null }
      });
      if (!user) throw new BadRequestException('Invalid assignee');
    }

    const deal = await this.prisma.deal.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        contact: data.contactId ? { connect: { id: data.contactId } } : undefined,
        organization: data.organizationId ? { connect: { id: data.organizationId } } : undefined,
        assignee: data.assignedTo ? { connect: { id: data.assignedTo } } : undefined,
        metadata: data.metadata as Prisma.InputJsonValue
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, color: true, probability: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true } }
      }
    });

    await this.invalidateCache('deal');
    return deal;
  }

  async updateDeal(id: string, data: Partial<{
    title: string;
    description: string;
    value: number;
    currency: string;
    pipelineId: string;
    stageId: string;
    contactId: string | null;
    organizationId: string | null;
    assignedTo: string | null;
    expectedCloseDate: Date | null;
    probability: number;
    source: string;
    tags: string[];
    metadata: Record<string, unknown>;
  }>) {
    const tenantId = this.getTenantId();
    await this.findDealById(id);

    if (data.pipelineId) {
      const pipeline = await this.prisma.pipeline.findFirst({
        where: { id: data.pipelineId, tenantId, deletedAt: null }
      });
      if (!pipeline) throw new BadRequestException('Invalid pipeline');
    }

    if (data.stageId) {
      const stage = await this.prisma.pipelineStage.findFirst({
        where: { id: data.stageId, pipelineId: data.pipelineId || (await this.prisma.deal.findUnique({ where: { id } })).pipelineId }
      });
      if (!stage) throw new BadRequestException('Invalid stage for pipeline');
    }

    const deal = await this.prisma.deal.update({
      where: { id },
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, color: true, probability: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true } }
      }
    });

    // If deal moved to closed-won/lost stage, update actualCloseDate
    if (data.stageId) {
      const stage = await this.prisma.pipelineStage.findUnique({ where: { id: data.stageId } });
      if (stage && (stage.name.toLowerCase().includes('won') || stage.name.toLowerCase().includes('lost'))) {
        await this.prisma.deal.update({
          where: { id },
          data: { actualCloseDate: new Date() }
        });
      }
    }

    await this.invalidateCache('deal');
    return deal;
  }

  async deleteDeal(id: string) {
    await this.findDealById(id);
    await this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateCache('deal');
    return { success: true };
  }

  // ============================================
  // CRM Activity Methods
  // ============================================

  async findAllActivities(params: {
    page?: number;
    limit?: number;
    type?: string;
    contactId?: string;
    dealId?: string;
    dueFrom?: Date;
    dueTo?: Date;
    completed?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const tenantId = this.getTenantId();
    const { page = 1, limit = 20, type, contactId, dealId, dueFrom, dueTo, completed, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, deletedAt: null };

    if (type) where.type = type;
    if (contactId) where.contactId = contactId;
    if (dealId) where.dealId = dealId;
    if (dueFrom || dueTo) {
      where.dueDate = {};
      if (dueFrom) where.dueDate.gte = dueFrom;
      if (dueTo) where.dueDate.lte = dueTo;
    }
    if (completed !== undefined) {
      if (completed) where.completedAt = { not: null };
      else where.completedAt = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.crmActivity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          deal: { select: { id: true, title: true } },
          organization: { select: { id: true, name: true } }
        }
      }),
      this.prisma.crmActivity.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createActivity(data: {
    type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK' | 'WHATSAPP' | 'LINKEDIN';
    subject: string;
    description?: string;
    contactId?: string;
    dealId?: string;
    organizationId?: string;
    dueDate?: Date;
    duration?: number;
    outcome?: string;
    metadata?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();

    if (data.contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: data.contactId, tenantId, deletedAt: null } });
      if (!contact) throw new BadRequestException('Invalid contact');
    }

    if (data.dealId) {
      const deal = await this.prisma.deal.findFirst({ where: { id: data.dealId, tenantId, deletedAt: null } });
      if (!deal) throw new BadRequestException('Invalid deal');
    }

    if (data.organizationId) {
      const org = await this.prisma.organization.findFirst({ where: { id: data.organizationId, tenantId, deletedAt: null } });
      if (!org) throw new BadRequestException('Invalid organization');
    }

    const activity = await this.prisma.crmActivity.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        metadata: data.metadata as Prisma.InputJsonValue
      }
    });

    // Update contact lastContactedAt if contactId provided
    if (data.contactId) {
      await this.prisma.contact.update({
        where: { id: data.contactId },
        data: { lastContactedAt: new Date(), status: 'CONTACTED' }
      });
    }

    await this.invalidateCache('activity');
    return activity;
  }

  async updateActivity(id: string, data: Partial<{
    type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK' | 'WHATSAPP' | 'LINKEDIN';
    subject: string;
    description: string;
    dueDate: Date | null;
    completedAt: Date | null;
    duration: number;
    outcome: string;
    metadata: Record<string, unknown>;
  }>) {
    const tenantId = this.getTenantId();
    const activity = await this.prisma.crmActivity.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!activity) throw new NotFoundException('Activity not found');

    const updated = await this.prisma.crmActivity.update({
      where: { id },
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      }
    });

    await this.invalidateCache('activity');
    return updated;
  }

  async completeActivity(id: string, outcome?: string) {
    const tenantId = this.getTenantId();
    const activity = await this.prisma.crmActivity.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!activity) throw new NotFoundException('Activity not found');

    const updated = await this.prisma.crmActivity.update({
      where: { id },
      data: { completedAt: new Date(), outcome }
    });

    await this.invalidateCache('activity');
    return updated;
  }

  async deleteActivity(id: string) {
    const tenantId = this.getTenantId();
    const activity = await this.prisma.crmActivity.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!activity) throw new NotFoundException('Activity not found');
    await this.prisma.crmActivity.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateCache('activity');
    return { success: true };
  }

  // ============================================
  // Dashboard / Stats
  // ============================================

  async getDashboardStats() {
    const tenantId = this.getTenantId();

    const [
      totalContacts,
      totalOrganizations,
      totalDeals,
      totalPipelineValue,
      dealsByStage,
      contactsByStatus,
      recentActivities,
      upcomingActivities
    ] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.organization.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.deal.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.deal.aggregate({ where: { tenantId, deletedAt: null }, _sum: { value: true } }),
      this.prisma.deal.groupBy({ by: ['stageId'], where: { tenantId, deletedAt: null }, _count: { id: true } }),
      this.prisma.contact.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: { id: true } }),
      this.prisma.crmActivity.findMany({
        where: { tenantId, deletedAt: null, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } }
      }),
      this.prisma.crmActivity.findMany({
        where: { tenantId, deletedAt: null, completedAt: null, dueDate: { gte: new Date() } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } }
      })
    ]);

    // Get stage names for dealsByStage
    const stageIds = dealsByStage.map(d => d.stageId);
    const stages = await this.prisma.pipelineStage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, color: true }
    });
    const stageMap = new Map(stages.map(s => [s.id, { name: s.name, color: s.color }]));

    return {
      totals: {
        contacts: totalContacts,
        organizations: totalOrganizations,
        deals: totalDeals,
        pipelineValue: totalPipelineValue._sum.value || 0
      },
      dealsByStage: dealsByStage.map(d => ({
        stageId: d.stageId,
        stageName: stageMap.get(d.stageId)?.name || 'Unknown',
        color: stageMap.get(d.stageId)?.color || '#6366f1',
        count: d._count.id
      })),
      contactsByStatus: contactsByStatus.map(c => ({ status: c.status, count: c._count.id })),
      recentActivities,
      upcomingActivities
    };
  }

  // ============================================
  // Cache Helpers
  // ============================================

  private async invalidateCache(type: string) {
    await this.redis.delPattern(`crm:${type}:*`);
  }
}