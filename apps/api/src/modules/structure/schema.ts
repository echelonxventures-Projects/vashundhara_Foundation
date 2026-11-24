import { CUSTOM_TYPES, KEY, RULE_OPS } from '@vashundhara-foundation/shared';
import { z } from 'zod';

const key = z.string().regex(KEY, 'Use lowercase letters, numbers and _');
const label = z.string().trim().min(1).max(80);
const name = z.string().max(60);
const choice = z.object({ value: z.string().min(1).max(60), label, archived: z.boolean().optional() }).strict();
const field = z.object({
  key, label, type: z.enum(CUSTOM_TYPES), hint: z.string().max(200).optional(), required: z.boolean().optional(), unique: z.boolean().optional(), personal: z.boolean().optional(),
  list: z.boolean().optional(), search: z.boolean().optional(), filter: z.boolean().optional(), choices: z.array(choice).max(200).optional(), ref: name.optional(),
  min: z.number().optional(), max: z.number().optional(), archived: z.boolean().optional()
}).strict();
const fields = z.array(field).max(200);
const names = z.array(name).max(100);
const layout = z.object({ title: label.optional(), labels: z.record(name, label).optional(), hidden: names.optional(), required: names.optional(), order: names.optional(), columns: z.array(name).max(12).optional(), choices: z.record(name, z.array(label).max(100)).optional() }).strict();
const access = z.object({ read: names.optional(), create: names.optional(), update: names.optional(), delete: names.optional() }).strict();
const table = z.object({ key, title: label, group: z.string().trim().max(40).optional(), fields, access: access.optional(), archived: z.boolean().optional() }).strict();
const form = z.object({ key, title: label, intro: z.string().max(2000).optional(), success: z.string().max(500).optional(), table: z.string().max(40), access: z.enum(['PUBLIC', 'MEMBERS']), active: z.boolean(), fields: z.array(z.object({ key: name, required: z.boolean().optional() }).strict()).max(100) }).strict();
const mail = { subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000) };
const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NOTIFY_ROLE'), role: name, channel: z.enum(['EMAIL', 'IN_APP']), ...mail }).strict(),
  z.object({ type: z.literal('EMAIL_FIELD'), field: name, ...mail }).strict(),
  z.object({ type: z.literal('TASK'), subject: mail.subject, dueInDays: z.number().int().min(0).max(365) }).strict(),
  z.object({ type: z.literal('WEBHOOK') }).strict()
]);
const rule = z.object({ key, name: label, entity: name, on: z.enum(['CREATED', 'UPDATED', 'SAVED']), active: z.boolean(), conditions: z.array(z.object({ field: name, op: z.enum(RULE_OPS), value: z.string().max(200).optional() }).strict()).max(10), actions: z.array(action).max(5) }).strict();
export const DefinitionSchema = z.object({ entities: z.record(name, z.object({ fields, layout: layout.optional() }).strict()), tables: z.array(table).max(200), forms: z.array(form).max(200), rules: z.array(rule).max(200) }).strict();
