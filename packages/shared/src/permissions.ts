/**
 * Single source of truth for permissions and built-in roles.
 * The seed, the API guards and the UI all read this file.
 */
export const ACTIONS = ['create', 'read', 'update', 'delete', 'manage', 'export', 'import'] as const;
export type Action = (typeof ACTIONS)[number];

const crud = ['create', 'read', 'update', 'delete'] as const;

export const RESOURCES = {
  platform: ['read', 'manage'],
  tenants: ['read', 'update', 'manage'],
  members: crud,
  roles: crud,
  settings: ['read', 'update'],
  compliance: ['read', 'update'],
  payment_accounts: ['read', 'update'],
  feature_flags: ['read', 'update'],
  translations: crud,
  currencies: ['read', 'update'],
  audit_logs: ['read', 'export'],
  notifications: ['create', 'read', 'manage'],
  files: ['create', 'read', 'delete'],
  webhooks: crud,
  api_keys: ['create', 'read', 'delete'],
  campaigns: crud,
  donors: [...crud, 'export', 'import'],
  donations: ['create', 'read', 'update', 'export'],
  refunds: ['create', 'read'],
  subscriptions: ['read', 'update'],
  receipts: ['read', 'manage'],
  finance: ['read', 'manage', 'export'],
  reports: ['read', 'export', 'manage'],
  crm: crud,
  volunteers: crud,
  shifts: crud,
  hours: ['create', 'read', 'manage'],
  certificates: ['create', 'read', 'delete'],
  beneficiaries: crud,
  cases: crud,
  aid: crud,
  field: ['create', 'read'],
  grants: crud,
  invoices: crud,
  content: crud,
  messages: ['read', 'update'],
  events: crud,
  students: crud,
  courses: crud,
  grading: ['read', 'update'],
  library: crud,
  feedback: ['read', 'update'],
  social: [...crud, 'manage'],
  programmes: crud,
  privacy: ['read', 'manage']
} as const satisfies Record<string, readonly Action[]>;

export type Resource = keyof typeof RESOURCES;
export type Permission = { [R in Resource]: `${R}:${(typeof RESOURCES)[R][number]}` }[Resource];

export const ALL_PERMISSIONS = Object.entries(RESOURCES).flatMap(([r, actions]) =>
  actions.map((a) => `${r}:${a}`)
) as Permission[];

const of = (...resources: Resource[]) =>
  resources.flatMap((r) => RESOURCES[r].map((a) => `${r}:${a}` as Permission));
const readOf = (...resources: Resource[]) =>
  resources.filter((r) => (RESOURCES[r] as readonly string[]).includes('read')).map((r) => `${r}:read` as Permission);

const TENANT_RESOURCES = (Object.keys(RESOURCES) as Resource[]).filter((r) => r !== 'platform' && r !== 'tenants');
const PROGRAMME: Resource[] = ['volunteers', 'shifts', 'hours', 'certificates', 'beneficiaries', 'cases', 'aid', 'field'];

export interface RoleTemplate {
  name: string;
  displayName: string;
  scope: 'SYSTEM' | 'TENANT';
  priority: number;
  permissions: Permission[];
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  { name: 'system_admin', displayName: 'System Administrator', scope: 'SYSTEM', priority: 100, permissions: ALL_PERMISSIONS },
  { name: 'tenant_admin', displayName: 'NGO Administrator', scope: 'TENANT', priority: 80, permissions: [...of(...TENANT_RESOURCES), 'tenants:read', 'tenants:update'] },
  { name: 'manager', displayName: 'Manager', scope: 'TENANT', priority: 60, permissions: [...of('campaigns', 'donors', 'crm', 'content', 'messages', 'notifications', 'grants', 'files', 'events', 'students', 'courses', 'grading', 'library', 'feedback', 'social', 'programmes', ...PROGRAMME), ...readOf('donations', 'subscriptions', 'receipts', 'reports', 'members', 'settings', 'invoices'), 'donations:create'] },
  { name: 'finance', displayName: 'Finance', scope: 'TENANT', priority: 55, permissions: [...of('donations', 'refunds', 'subscriptions', 'receipts', 'finance', 'reports', 'invoices', 'compliance'), ...readOf('donors', 'campaigns', 'grants', 'files', 'settings'), 'donors:update', 'files:create'] },
  { name: 'auditor', displayName: 'Auditor (read only)', scope: 'TENANT', priority: 50, permissions: [...readOf('donations', 'refunds', 'subscriptions', 'receipts', 'finance', 'reports', 'invoices', 'grants', 'campaigns', 'audit_logs', 'compliance'), 'finance:export', 'reports:export', 'audit_logs:export'] },
  { name: 'field_worker', displayName: 'Field Worker', scope: 'TENANT', priority: 45, permissions: [...of('field', 'files'), ...readOf('beneficiaries', 'cases', 'aid'), 'beneficiaries:create', 'cases:update', 'aid:create'] },
  { name: 'member', displayName: 'Staff Member', scope: 'TENANT', priority: 40, permissions: readOf('campaigns', 'donors', 'crm', 'volunteers', 'shifts', 'files', 'content', 'notifications') },
  { name: 'teacher', displayName: 'Teacher', scope: 'TENANT', priority: 42, permissions: [...of('courses', 'grading', 'library', 'files'), ...readOf('students')] },
  { name: 'content_creator', displayName: 'Content Creator', scope: 'TENANT', priority: 41, permissions: [...of('content', 'files'), 'social:create', 'social:read', 'social:update', 'campaigns:read', 'events:read', 'library:create', 'library:read', 'library:update'] },
  { name: 'student', displayName: 'Student', scope: 'TENANT', priority: 13, permissions: [] },
  { name: 'csr_partner', displayName: 'CSR Partner', scope: 'TENANT', priority: 20, permissions: [] },
  { name: 'volunteer', displayName: 'Volunteer', scope: 'TENANT', priority: 15, permissions: [] },
  { name: 'beneficiary', displayName: 'Beneficiary', scope: 'TENANT', priority: 12, permissions: [] },
  { name: 'donor', displayName: 'Donor', scope: 'TENANT', priority: 10, permissions: [] }
];

/** Roles anyone may hold after self-registration. Staff roles need an invitation. */
export const SELF_SERVICE_ROLES = ['donor', 'volunteer', 'beneficiary', 'student'] as const;

/** "manage" implies every other action on the same resource. */
export function hasPermission(granted: Iterable<string>, required: string): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return set.has(required) || set.has(`${required.split(':')[0]}:manage`);
}
