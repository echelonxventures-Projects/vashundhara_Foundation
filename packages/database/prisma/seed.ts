import { PrismaClient } from '@vashundhara-foundation/database';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================
  // CURRENCIES
  // ============================================
  const currencies = [
    { code: 'USD', name: 'US Dollar', namePlural: 'US Dollars', symbol: '$', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: true, formatting: {} },
    { code: 'INR', name: 'Indian Rupee', namePlural: 'Indian Rupees', symbol: '₹', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'EUR', name: 'Euro', namePlural: 'Euros', symbol: '€', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'GBP', name: 'British Pound', namePlural: 'British Pounds', symbol: '£', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'JPY', name: 'Japanese Yen', namePlural: 'Japanese Yen', symbol: '¥', symbolPosition: 'prefix', decimals: 0, isActive: true, isBase: false, formatting: {} },
    { code: 'CAD', name: 'Canadian Dollar', namePlural: 'Canadian Dollars', symbol: 'C$', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'AUD', name: 'Australian Dollar', namePlural: 'Australian Dollars', symbol: 'A$', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'SGD', name: 'Singapore Dollar', namePlural: 'Singapore Dollars', symbol: 'S$', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'AED', name: 'UAE Dirham', namePlural: 'UAE Dirhams', symbol: 'د.إ', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
    { code: 'SAR', name: 'Saudi Riyal', namePlural: 'Saudi Riyals', symbol: '﷼', symbolPosition: 'prefix', decimals: 2, isActive: true, isBase: false, formatting: {} },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code as any },
      update: currency as any,
      create: currency as any,
    });
  }
  console.log('✅ Currencies seeded');

  // ============================================
  // LOCALES
  // ============================================
  const locales = [
    { code: 'en', name: 'English', nativeName: 'English', rtl: false, dateFormat: 'MM/dd/yyyy', timeFormat: 'h:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 0 },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 1 },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 2 },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 3 },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 4 },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 5 },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 6 },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 7 },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 8 },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 9 },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 10 },
    { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', rtl: false, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 11 },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', rtl: true, dateFormat: 'dd/MM/yyyy', timeFormat: 'hh:mm a', numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, pluralRules: {}, isActive: true, isSystem: true, sortOrder: 12 },
  ];

  for (const locale of locales) {
    await prisma.locale.upsert({
      where: { code: locale.code as any },
      update: locale as any,
      create: locale as any,
    });
  }
  console.log('✅ Locales seeded');

  // ============================================
  // SYSTEM PERMISSIONS
  // ============================================
  const permissions = [
    // System permissions
    { resource: 'system', action: 'MANAGE', description: 'Full system administration access' },
    { resource: 'system', action: 'READ', description: 'Read system configuration' },
    { resource: 'system', action: 'UPDATE', description: 'Write system configuration' },
    { resource: 'tenants', action: 'MANAGE', description: 'Manage tenants' },
    { resource: 'users', action: 'MANAGE', description: 'Manage all users' },
    { resource: 'roles', action: 'MANAGE', description: 'Manage roles and permissions' },
    { resource: 'audit', action: 'READ', description: 'Read audit logs' },
    { resource: 'webhooks', action: 'MANAGE', description: 'Manage webhooks' },

    // Tenant permissions
    { resource: 'tenant', action: 'MANAGE', description: 'Full tenant administration' },
    { resource: 'tenant', action: 'READ', description: 'Read tenant configuration' },
    { resource: 'tenant', action: 'UPDATE', description: 'Write tenant configuration' },
    { resource: 'users', action: 'MANAGE', description: 'Manage tenant users' },
    { resource: 'users', action: 'CREATE', description: 'Invite users to tenant' },
    { resource: 'roles', action: 'MANAGE', description: 'Manage tenant roles' },

    // Donation permissions
    { resource: 'donations', action: 'CREATE', description: 'Create donations' },
    { resource: 'donations', action: 'READ', description: 'View donations' },
    { resource: 'donations', action: 'UPDATE', description: 'Update donations' },
    { resource: 'donations', action: 'DELETE', description: 'Delete donations' },
    { resource: 'donations', action: 'EXPORT', description: 'Export donations' },

    // Campaign permissions
    { resource: 'campaigns', action: 'CREATE', description: 'Create campaigns' },
    { resource: 'campaigns', action: 'READ', description: 'View campaigns' },
    { resource: 'campaigns', action: 'UPDATE', description: 'Update campaigns' },
    { resource: 'campaigns', action: 'DELETE', description: 'Delete campaigns' },
    { resource: 'campaigns', action: 'MANAGE', description: 'Publish campaigns' },

    // Donor permissions
    { resource: 'donors', action: 'CREATE', description: 'Create donors' },
    { resource: 'donors', action: 'READ', description: 'View donors' },
    { resource: 'donors', action: 'UPDATE', description: 'Update donors' },
    { resource: 'donors', action: 'DELETE', description: 'Delete donors' },
    { resource: 'donors', action: 'EXPORT', description: 'Export donors' },

    // Subscription permissions
    { resource: 'subscriptions', action: 'CREATE', description: 'Create subscriptions' },
    { resource: 'subscriptions', action: 'READ', description: 'View subscriptions' },
    { resource: 'subscriptions', action: 'UPDATE', description: 'Update subscriptions' },
    { resource: 'subscriptions', action: 'DELETE', description: 'Cancel subscriptions' },

    // Report permissions
    { resource: 'reports', action: 'READ', description: 'View reports' },
    { resource: 'reports', action: 'CREATE', description: 'Create reports' },
    { resource: 'reports', action: 'EXPORT', description: 'Export reports' },
    { resource: 'reports', action: 'MANAGE', description: 'Schedule reports' },

    // Payment permissions
    { resource: 'payments', action: 'READ', description: 'View payments' },
    { resource: 'payments', action: 'CREATE', description: 'Process payments' },
    { resource: 'payments', action: 'UPDATE', description: 'Refund payments' },

    // Invoice permissions
    { resource: 'invoices', action: 'CREATE', description: 'Create invoices' },
    { resource: 'invoices', action: 'READ', description: 'View invoices' },
    { resource: 'invoices', action: 'UPDATE', description: 'Update invoices' },
    { resource: 'invoices', action: 'MANAGE', description: 'Send invoices' },

    // File permissions
    { resource: 'files', action: 'CREATE', description: 'Upload files' },
    { resource: 'files', action: 'READ', description: 'View files' },
    { resource: 'files', action: 'DELETE', description: 'Delete files' },

    // Notification permissions
    { resource: 'notifications', action: 'CREATE', description: 'Create notifications' },
    { resource: 'notifications', action: 'READ', description: 'View notifications' },
    { resource: 'notifications', action: 'MANAGE', description: 'Send notifications' },

    // Webhook permissions
    { resource: 'webhooks', action: 'CREATE', description: 'Create webhooks' },
    { resource: 'webhooks', action: 'READ', description: 'View webhooks' },
    { resource: 'webhooks', action: 'UPDATE', description: 'Update webhooks' },
    { resource: 'webhooks', action: 'DELETE', description: 'Delete webhooks' },

    // Feature flag permissions
    { resource: 'feature-flags', action: 'READ', description: 'View feature flags' },
    { resource: 'feature-flags', action: 'MANAGE', description: 'Manage feature flags' },

    // Settings permissions
    { resource: 'settings', action: 'READ', description: 'View settings' },
    { resource: 'settings', action: 'UPDATE', description: 'Update settings' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action as any,
        },
      },
      update: permission as any,
      create: permission as any,
    });
  }
  console.log('✅ Permissions seeded');

  // ============================================
  // SYSTEM ROLES
  // ============================================
  const systemRoles = [
    { name: 'SYSTEM_ADMIN', displayName: 'System Administrator', description: 'Full system administrator with all permissions', scope: 'SYSTEM' as const, priority: 100 },
    { name: 'TENANT_ADMIN', displayName: 'Tenant Administrator', description: 'Tenant administrator with full tenant access', scope: 'TENANT' as const, priority: 80 },
    { name: 'MANAGER', displayName: 'Manager', description: 'Manager with operational permissions', scope: 'TENANT' as const, priority: 60 },
    { name: 'MEMBER', displayName: 'Member', description: 'Regular member with basic permissions', scope: 'TENANT' as const, priority: 40 },
  ];

  const systemRolesCreated: any[] = [];
  for (const roleData of systemRoles) {
    const existing = await prisma.role.findFirst({
      where: { name: roleData.name, scope: roleData.scope, tenantId: null },
    });
    if (existing) {
      systemRolesCreated.push(existing);
    } else {
      const created = await prisma.role.create({
        data: {
          ...roleData,
          isSystem: true,
          tenantId: null,
        },
      });
      systemRolesCreated.push(created);
    }
  }

  const [systemAdminRole, tenantAdminRole, managerRole, memberRole] = systemRolesCreated;

  // Assign all system permissions to SYSTEM_ADMIN
  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map(p => ({
      roleId: systemAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  // Assign tenant admin permissions to TENANT_ADMIN
  const tenantPermissions = await prisma.permission.findMany({
    where: { resource: { in: ['tenant', 'users', 'roles', 'donations', 'campaigns', 'donors', 'subscriptions', 'reports', 'payments', 'invoices', 'files', 'notifications', 'webhooks', 'feature-flags', 'settings'] } },
  });
  await prisma.rolePermission.createMany({
    data: tenantPermissions.map(p => ({
      roleId: tenantAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  // Assign operational permissions to MANAGER
  const managerPermissionNames = [
    'donations:CREATE', 'donations:READ', 'donations:UPDATE', 'donations:EXPORT',
    'campaigns:CREATE', 'campaigns:READ', 'campaigns:UPDATE', 'campaigns:MANAGE',
    'donors:CREATE', 'donors:READ', 'donors:UPDATE', 'donors:EXPORT',
    'subscriptions:CREATE', 'subscriptions:READ', 'subscriptions:UPDATE', 'subscriptions:DELETE',
    'reports:READ', 'reports:CREATE', 'reports:EXPORT', 'reports:MANAGE',
    'payments:READ', 'payments:CREATE', 'payments:UPDATE',
    'invoices:CREATE', 'invoices:READ', 'invoices:UPDATE', 'invoices:MANAGE',
    'files:CREATE', 'files:READ', 'files:DELETE',
    'notifications:CREATE', 'notifications:READ', 'notifications:MANAGE',
    'webhooks:READ',
    'feature-flags:READ',
    'settings:READ', 'settings:UPDATE',
  ];
  const managerPermissions = await prisma.permission.findMany({
    where: {
      OR: managerPermissionNames.map(s => {
        const [resource, action] = s.split(':');
        return { resource, action: action as any };
      }),
    },
  });
  await prisma.rolePermission.createMany({
    data: managerPermissions.map(p => ({
      roleId: managerRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  // Assign basic permissions to MEMBER
  const memberPermissionNames = [
    'donations:CREATE', 'donations:READ',
    'campaigns:READ',
    'donors:READ',
    'subscriptions:READ',
    'reports:READ',
    'payments:READ',
    'invoices:READ',
    'files:READ',
    'notifications:READ',
    'settings:READ',
  ];
  const memberPermissions = await prisma.permission.findMany({
    where: {
      OR: memberPermissionNames.map(s => {
        const [resource, action] = s.split(':');
        return { resource, action: action as any };
      }),
    },
  });
  await prisma.rolePermission.createMany({
    data: memberPermissions.map(p => ({
      roleId: memberRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  console.log('✅ Roles seeded');

  // ============================================
  // DEFAULT TENANT
  // ============================================
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo',
      displayName: 'Demo Organization',
      description: 'Demo tenant for testing',
      primaryDomain: 'demo.vashundharafoundation.org',
      status: 'ACTIVE',
      defaultCurrency: 'USD',
      defaultLocale: 'en',
      supportedCurrencies: ['USD', 'INR', 'EUR', 'GBP'],
      supportedLocales: ['en', 'hi', 'bn', 'ta', 'te'],
      timezone: 'UTC',
      settings: {
        timezone: 'UTC',
        dateFormat: 'MM/dd/yyyy',
        timeFormat: 'h:mm a',
        currencyFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        theme: 'light',
        logo: null,
        favicon: null,
        primaryColor: '#3B82F6',
        secondaryColor: '#64748B',
        allowRegistration: true,
        requireEmailVerification: true,
        sessionTimeout: 3600,
        maxFileSize: 10485760,
        allowedFileTypes: ['image/*', 'application/pdf', 'text/csv'],
      },
    },
  });
  console.log('✅ Default tenant seeded');

  // ============================================
  // SYSTEM CONFIG
  // ============================================
  const systemConfigs = [
    {
      key: 'platform.name',
      value: 'Vashundhara Foundation',
      description: 'Platform display name',
      category: 'platform',
      isPublic: true,
    },
    {
      key: 'platform.description',
      value: 'Enterprise-grade multi-tenant, multi-lingual, multi-currency platform for NGOs worldwide.',
      category: 'platform',
      isPublic: true,
    },
    {
      key: 'platform.version',
      value: '1.0.0',
      category: 'platform',
      isPublic: true,
    },
    {
      key: 'auth.session.ttl',
      value: 3600,
      category: 'auth',
      isPublic: false,
    },
    {
      key: 'auth.session.refreshTtl',
      value: 604800,
      category: 'auth',
      isPublic: false,
    },
    {
      key: 'auth.password.minLength',
      value: 8,
      category: 'auth',
      isPublic: true,
    },
    {
      key: 'auth.password.requireUppercase',
      value: true,
      category: 'auth',
      isPublic: true,
    },
    {
      key: 'auth.password.requireLowercase',
      value: true,
      category: 'auth',
      isPublic: true,
    },
    {
      key: 'auth.password.requireNumbers',
      value: true,
      category: 'auth',
      isPublic: true,
    },
    {
      key: 'auth.password.requireSpecialChars',
      value: true,
      category: 'auth',
      isPublic: true,
    },
    {
      key: 'auth.mfa.enabled',
      value: true,
      category: 'auth',
      isPublic: true,
    },
    {
      key: 'auth.mfa.requiredForAdmins',
      value: true,
      category: 'auth',
      isPublic: false,
    },
    {
      key: 'exchangeRate.provider',
      value: 'exchangerate-api.com',
      category: 'exchangeRate',
      isPublic: false,
    },
    {
      key: 'exchangeRate.updateInterval',
      value: 3600,
      category: 'exchangeRate',
      isPublic: false,
    },
    {
      key: 'exchangeRate.baseCurrency',
      value: 'USD',
      category: 'exchangeRate',
      isPublic: true,
    },
    {
      key: 'fileStorage.provider',
      value: 'local',
      category: 'fileStorage',
      isPublic: false,
    },
    {
      key: 'fileStorage.maxFileSize',
      value: 10485760,
      category: 'fileStorage',
      isPublic: true,
    },
    {
      key: 'email.provider',
      value: 'sendgrid',
      category: 'email',
      isPublic: false,
    },
    {
      key: 'sms.provider',
      value: 'twilio',
      category: 'sms',
      isPublic: false,
    },
    {
      key: 'featureFlags.provider',
      value: 'database',
      category: 'featureFlags',
      isPublic: false,
    },
    {
      key: 'maintenance.mode',
      value: false,
      category: 'maintenance',
      isPublic: true,
    },
    {
      key: 'rateLimit.auth.maxRequests',
      value: 10,
      category: 'rateLimit',
      isPublic: false,
    },
    {
      key: 'rateLimit.auth.windowMs',
      value: 900000,
      category: 'rateLimit',
      isPublic: false,
    },
    {
      key: 'rateLimit.api.maxRequests',
      value: 100,
      category: 'rateLimit',
      isPublic: false,
    },
    {
      key: 'rateLimit.api.windowMs',
      value: 60000,
      category: 'rateLimit',
      isPublic: false,
    },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    });
  }
  console.log('✅ System configs seeded');

  // ============================================
  // FEATURE FLAGS
  // ============================================
  const featureFlags = [
    {
      key: 'donations.recurring',
      name: 'Recurring Donations',
      description: 'Enable recurring donation subscriptions',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'campaigns.crowdfunding',
      name: 'Crowdfunding Campaigns',
      description: 'Enable crowdfunding-style campaigns with goals and progress bars',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'donors.portal',
      name: 'Donor Portal',
      description: 'Enable self-service donor portal',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'reports.scheduled',
      name: 'Scheduled Reports',
      description: 'Enable scheduled report generation and email delivery',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'payments.razorpay',
      name: 'Razorpay Integration',
      description: 'Enable Razorpay payment gateway',
      type: 'BOOLEAN',
      defaultValue: false,
      isEnabled: false,
      rolloutPercentage: 0,
      targetingRules: {},
    },
    {
      key: 'payments.stripe',
      name: 'Stripe Integration',
      description: 'Enable Stripe payment gateway',
      type: 'BOOLEAN',
      defaultValue: false,
      isEnabled: false,
      rolloutPercentage: 0,
      targetingRules: {},
    },
    {
      key: 'payments.paypal',
      name: 'PayPal Integration',
      description: 'Enable PayPal payment gateway',
      type: 'BOOLEAN',
      defaultValue: false,
      isEnabled: false,
      rolloutPercentage: 0,
      targetingRules: {},
    },
    {
      key: 'notifications.email',
      name: 'Email Notifications',
      description: 'Enable email notifications',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'notifications.sms',
      name: 'SMS Notifications',
      description: 'Enable SMS notifications',
      type: 'BOOLEAN',
      defaultValue: false,
      isEnabled: false,
      rolloutPercentage: 0,
      targetingRules: {},
    },
    {
      key: 'notifications.push',
      name: 'Push Notifications',
      description: 'Enable push notifications',
      type: 'BOOLEAN',
      defaultValue: false,
      isEnabled: false,
      rolloutPercentage: 0,
      targetingRules: {},
    },
    {
      key: 'webhooks.enabled',
      name: 'Webhooks',
      description: 'Enable webhook system for external integrations',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'files.minio',
      name: 'MinIO Storage',
      description: 'Enable MinIO/S3-compatible file storage',
      type: 'BOOLEAN',
      defaultValue: false,
      isEnabled: false,
      rolloutPercentage: 0,
      targetingRules: {},
    },
    {
      key: 'i18n.rtl',
      name: 'RTL Language Support',
      description: 'Enable right-to-left language support (Urdu)',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'analytics.advanced',
      name: 'Advanced Analytics',
      description: 'Enable advanced analytics and dashboards',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'api.rateLimit',
      name: 'API Rate Limiting',
      description: 'Enable API rate limiting',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'audit.logging',
      name: 'Audit Logging',
      description: 'Enable comprehensive audit logging',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'tenant.customDomain',
      name: 'Custom Domains',
      description: 'Allow tenants to use custom domains',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'tenant.whiteLabel',
      name: 'White Labeling',
      description: 'Enable white-label customization for tenants',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'export.csv',
      name: 'CSV Export',
      description: 'Enable CSV export functionality',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'export.pdf',
      name: 'PDF Export',
      description: 'Enable PDF export functionality',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'import.csv',
      name: 'CSV Import',
      description: 'Enable CSV import for donors, donations',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
    {
      key: 'gdpr.compliance',
      name: 'GDPR Compliance',
      description: 'Enable GDPR data protection features',
      type: 'BOOLEAN',
      defaultValue: true,
      isEnabled: true,
      rolloutPercentage: 100,
      targetingRules: {},
    },
  ];

  for (const flag of featureFlags) {
    const existing = await prisma.featureFlag.findFirst({
      where: { key: flag.key, tenantId: null },
    });
    if (existing) {
      await prisma.featureFlag.update({
        where: { id: existing.id },
        data: flag as any,
      });
    } else {
      await prisma.featureFlag.create({
        data: { ...flag, tenantId: null } as any,
      });
    }
  }
  console.log('✅ Feature flags seeded');

  // ============================================
  // DEFAULT EXCHANGE RATES (sample)
  // ============================================
  const usdCurrency = await prisma.currency.findUnique({ where: { code: 'USD' } });
  const inrCurrency = await prisma.currency.findUnique({ where: { code: 'INR' } });
  const eurCurrency = await prisma.currency.findUnique({ where: { code: 'EUR' } });
  const gbpCurrency = await prisma.currency.findUnique({ where: { code: 'GBP' } });
  const jpyCurrency = await prisma.currency.findUnique({ where: { code: 'JPY' } });
  const cadCurrency = await prisma.currency.findUnique({ where: { code: 'CAD' } });
  const audCurrency = await prisma.currency.findUnique({ where: { code: 'AUD' } });
  const sgdCurrency = await prisma.currency.findUnique({ where: { code: 'SGD' } });
  const aedCurrency = await prisma.currency.findUnique({ where: { code: 'AED' } });
  const sarCurrency = await prisma.currency.findUnique({ where: { code: 'SAR' } });

  if (usdCurrency && inrCurrency && eurCurrency && gbpCurrency && jpyCurrency && cadCurrency && audCurrency && sgdCurrency && aedCurrency && sarCurrency) {
    const exchangeRates = [
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: usdCurrency.id, rate: 1.0, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: inrCurrency.id, rate: 83.12, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: eurCurrency.id, rate: 0.92, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: gbpCurrency.id, rate: 0.79, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: jpyCurrency.id, rate: 151.50, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: cadCurrency.id, rate: 1.36, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: audCurrency.id, rate: 1.53, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: sgdCurrency.id, rate: 1.35, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: aedCurrency.id, rate: 3.67, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
      { baseCurrencyId: usdCurrency.id, targetCurrencyId: sarCurrency.id, rate: 3.75, source: 'exchangerate-api.com', validFrom: new Date(), isManual: false },
    ];

    for (const rate of exchangeRates) {
      const existing = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrencyId: rate.baseCurrencyId,
          targetCurrencyId: rate.targetCurrencyId,
          validFrom: rate.validFrom,
          tenantId: null,
        },
      });
      if (existing) {
        await prisma.exchangeRate.update({
          where: { id: existing.id },
          data: rate as any,
        });
      } else {
        await prisma.exchangeRate.create({
          data: { ...rate, tenantId: null } as any,
        });
      }
    }
  }
  console.log('✅ Exchange rates seeded');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });