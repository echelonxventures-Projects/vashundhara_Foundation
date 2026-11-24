import { BadRequestException, Controller, Get, Module } from '@nestjs/common';
import { ContactStatus, CrmActivityType, CurrencyCode, OrganizationSize } from '@prisma/client';
import { z } from 'zod';
import { crudController } from '../../common/crud/crud';
import { Can } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';

const id = z.string().max(60);
const text = (n: number) => z.string().trim().min(1).max(n);
const opt = (n: number) => z.string().trim().max(n).nullish();
const tags = z.array(z.string().max(30)).max(30).optional();
const address = z.record(z.string().max(30), z.string().max(200)).nullish();
const email = z.email().max(200).nullish();

const Contacts = crudController({
  path: 'crm/contacts', resource: 'crm', model: 'contact', search: ['firstName', 'lastName', 'email', 'phone'], filters: ['status', 'organizationId', 'tags'], sort: ['lastName', 'leadScore'], include: { organization: { select: { id: true, name: true } } },
  schema: z.object({ firstName: text(80), lastName: text(80), email, phone: opt(20), mobile: opt(20), whatsapp: opt(20), jobTitle: opt(100), department: opt(100), source: opt(60), status: z.enum(ContactStatus).optional(), leadScore: z.number().int().min(0).max(100).optional(), tags, notes: opt(5000), address, organizationId: id.nullish() })
});
const Organizations = crudController({
  path: 'crm/organizations', resource: 'crm', model: 'organization', search: ['name', 'email', 'gstNumber'], filters: ['industry', 'size'], sort: ['name'],
  schema: z.object({ name: text(200), legalName: opt(200), website: z.url().max(300).nullish(), industry: opt(80), size: z.enum(OrganizationSize).nullish(), description: opt(2000), phone: opt(20), email, gstNumber: opt(20), panNumber: opt(12), address, tags })
});
const StageSchema = z.array(z.object({ name: text(60), probability: z.number().int().min(0).max(100) })).min(1).max(15);
const Pipelines = crudController({
  path: 'crm/pipelines', resource: 'crm', model: 'pipeline', search: ['name'], include: { pipelineStages: { orderBy: { order: 'asc' } } },
  schema: z.object({ name: text(80), description: opt(300), isDefault: z.boolean().optional(), stages: StageSchema }),
  prepare: async (d, { existing, prisma }) => {
    const { stages, ...rest } = d;
    if (!stages) return rest;
    if (existing && (await prisma.deal.count({ where: { pipelineId: existing.id } }))) throw new BadRequestException('Stages cannot be replaced while deals use them');
    const create = stages.map((s: { name: string; probability: number }, order: number) => ({ ...s, order }));
    return { ...rest, pipelineStages: existing ? { deleteMany: {}, create } : { create } };
  }
});
const Deals = crudController({
  path: 'crm/deals', resource: 'crm', model: 'deal', search: ['title'], filters: ['pipelineId', 'stageId', 'contactId', 'organizationId', 'assignedTo'], sort: ['value', 'expectedCloseDate'],
  include: { stage: true, contact: { select: { id: true, firstName: true, lastName: true } }, organization: { select: { id: true, name: true } } },
  schema: z.object({ title: text(150), description: opt(2000), value: z.number().min(0).max(1e13), currency: z.enum(CurrencyCode).optional(), pipelineId: id, stageId: id, contactId: id.nullish(), organizationId: id.nullish(), assignedTo: id.nullish(), expectedCloseDate: z.coerce.date().nullish(), actualCloseDate: z.coerce.date().nullish(), probability: z.number().int().min(0).max(100).optional(), source: opt(60), tags }),
  prepare: async (d, { prisma }) => {
    if (d.assignedTo && !(await prisma.membership.findFirst({ where: { userId: d.assignedTo } }))) throw new BadRequestException('Assign the deal to a member of your organisation');
    return d;
  }
});
const Activities = crudController({
  path: 'crm/activities', resource: 'crm', model: 'crmActivity', search: ['subject'], filters: ['type', 'contactId', 'dealId', 'organizationId'], sort: ['dueDate'], include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, title: true } } },
  schema: z.object({ type: z.enum(CrmActivityType), subject: text(200), description: opt(5000), dueDate: z.coerce.date().nullish(), completedAt: z.coerce.date().nullish(), duration: z.number().int().min(0).max(10_000).nullish(), outcome: opt(500), contactId: id.nullish(), dealId: id.nullish(), organizationId: id.nullish() }),
  after: async (row, { prisma, created }) => { if (created && row.contactId) await prisma.contact.update({ where: { id: row.contactId }, data: { lastContactedAt: new Date() } }); }
});

@Controller('crm/dashboard')
export class CrmDashboardController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Can('crm:read')
  async stats() {
    const live = { deletedAt: null };
    const [contacts, organizations, value, byStage, upcoming] = await Promise.all([
      this.prisma.contact.count({ where: live }), this.prisma.organization.count({ where: live }), this.prisma.deal.aggregate({ where: live, _sum: { value: true }, _count: true }),
      this.prisma.deal.groupBy({ by: ['stageId'], where: live, _count: true, _sum: { value: true } }),
      this.prisma.crmActivity.findMany({ where: { ...live, completedAt: null, dueDate: { gte: new Date() } }, orderBy: { dueDate: 'asc' }, take: 10 })
    ]);
    const stages = await this.prisma.pipelineStage.findMany({ where: { id: { in: byStage.map((s) => s.stageId) } }, select: { id: true, name: true } });
    return { contacts, organizations, deals: value._count, pipelineValue: Number(value._sum.value ?? 0), byStage: byStage.map((s) => ({ stage: stages.find((x) => x.id === s.stageId)?.name, count: s._count, value: Number(s._sum.value ?? 0) })), upcoming };
  }
}
@Module({ controllers: [CrmDashboardController, Contacts, Organizations, Pipelines, Deals, Activities] })
export class CrmModule {}
