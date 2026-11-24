import { Injectable, OnModuleInit } from '@nestjs/common';
import { CustomField, ruleFields, RuleAction, ruleMatches, tableOf } from '@vashundhara-foundation/shared';
import { requireTenant } from '../../common/context/context';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';
import { ENTITY_MODEL, StructureService } from '../../common/structure/structure.service';
import { WebhooksService } from '../system/webhooks';

type Row = Record<string, any>;
interface Payload { entity: string; id: string; event: 'CREATED' | 'UPDATED'; changed: string[] }

/** Runs an NGO's "when this happens, do that" rules. What a rule does never triggers another rule. */
@Injectable()
export class RulesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, private readonly structure: StructureService, private readonly webhooks: WebhooksService) {}
  onModuleInit() { this.jobs.register('structure.rules', (p: Payload) => this.run(p)); }

  private async row(entity: string, id: string): Promise<Row | null> {
    const t = tableOf(entity);
    if (t) return ((await this.prisma.customRecord.findFirst({ where: { id, tableKey: t, deletedAt: null } }))?.data as Row | undefined) ?? null;
    const r = await (this.prisma as any)[ENTITY_MODEL[entity]].findFirst({ where: { id } });
    if (!r || r.deletedAt) return null;
    const custom = (await this.structure.valuesFor(entity, [id])).get(id) ?? {};
    return { ...r, ...Object.fromEntries(Object.entries(custom).map(([k, v]) => [`custom.${k}`, v])) };
  }
  async run(p: Payload) {
    const d = await this.structure.published();
    const rules = d.rules.filter((r) => r.active && r.entity === p.entity && (r.on === 'SAVED' || r.on === p.event));
    const row = rules.length ? await this.row(p.entity, p.id) : null;
    if (!row) return;
    const allowed = ruleFields(d, p.entity).map((f) => f.key);
    const fields = this.structure.fieldsOf(d, p.entity);
    const field = (k: string) => (tableOf(p.entity) ? fields.find((f) => f.key === k) : k.startsWith('custom.') ? fields.find((f) => f.key === k.slice(7)) : undefined);
    // Conditions compare rupees and plain dates, the way people type them.
    const plain = (k: string, v: any) => (v === null || v === undefined ? v : v instanceof Date ? v.toISOString().slice(0, 10) : field(k)?.type === 'money' || k.endsWith('Minor') ? Number(v) / 100 : typeof v === 'object' && !Array.isArray(v) ? String(v) : v);
    const safe: Row = Object.fromEntries(allowed.map((k) => [k, plain(k, row[k])]));
    const text: Row = Object.fromEntries(allowed.map((k) => [k, this.show(field(k), safe[k])]));
    await this.prisma.$transaction(async (tx: any) => {
      for (const r of rules) if (ruleMatches(r, safe, p.changed)) for (const a of r.actions) await this.act(tx, a, r.key, p, safe, text);
    });
  }
  private show(f: CustomField | undefined, v: any): string {
    if (v === undefined || v === null) return '';
    if (f?.type === 'select') return f.choices?.find((c) => c.value === v)?.label ?? String(v);
    if (f?.type === 'multi') return (v as string[]).map((x) => f.choices?.find((c) => c.value === x)?.label ?? x).join(', ');
    return Array.isArray(v) ? v.join(', ') : String(v);
  }
  private async act(tx: any, a: RuleAction, rule: string, p: Payload, row: Row, text: Row) {
    const tenantId = requireTenant().id;
    const fill = (s: string) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => String(text[k] ?? ''));
    const line = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 200);
    if (a.type === 'NOTIFY_ROLE') {
      const people = await tx.membership.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { name: a.role, deletedAt: null } } } }, include: { user: { select: { id: true, email: true } } }, take: 200 });
      for (const m of people) {
        const inApp = a.channel === 'IN_APP';
        const n = await tx.notification.create({ data: { tenantId, channel: a.channel, recipient: m.user.email, userId: m.userId, subject: line(fill(a.subject)), content: fill(a.body), status: inApp ? 'DELIVERED' : 'PENDING', sentAt: inApp ? new Date() : null, metadata: { rule } } });
        if (!inApp) await this.jobs.enqueue('notification.send', { id: n.id }, { tx, tenantId });
      }
    } else if (a.type === 'EMAIL_FIELD') {
      // The address may come from a public form, so the text is fixed and each address hears from a rule once a day.
      const to = String(row[a.field] ?? '');
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(to)) return;
      if (await tx.notification.findFirst({ where: { recipient: to, createdAt: { gt: new Date(Date.now() - 86400_000) }, metadata: { path: ['rule'], equals: rule } }, select: { id: true } })) return;
      const n = await tx.notification.create({ data: { tenantId, channel: 'EMAIL', recipient: to, subject: line(a.subject), content: a.body, metadata: { rule } } });
      await this.jobs.enqueue('notification.send', { id: n.id }, { tx, tenantId });
    } else if (a.type === 'TASK') {
      const link = p.entity === 'contacts' ? { contactId: p.id } : p.entity === 'deals' ? { dealId: p.id } : p.entity === 'organizations' ? { organizationId: p.id } : {};
      await tx.crmActivity.create({ data: { type: 'TASK', subject: line(fill(a.subject)), dueDate: new Date(Date.now() + a.dueInDays * 86400_000), ...link } });
    } else {
      // Ids only: the receiver fetches what its API key allows.
      await this.webhooks.emit('RECORD_SAVED', { rule, entity: p.entity, id: p.id, change: p.event }, tx);
    }
  }
}
