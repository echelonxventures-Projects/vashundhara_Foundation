/**
 * Vashundhara Foundation API - Root Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule as AppConfigModule } from './modules/config/config.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { FileModule } from './modules/file/file.module';
import { HealthModule } from './modules/health/health.module';
import { I18nModule } from './modules/i18n/i18n.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleModule } from './modules/role/role.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { CrmModule } from './modules/crm/crm.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100
      }
    ]),

    // Core Modules
    PrismaModule,
    RedisModule,

    // Feature Modules
    AuthModule,
    TenantModule,
    UserModule,
    RoleModule,
    PermissionModule,
    AppConfigModule,
    I18nModule,
    CurrencyModule,
    FeatureFlagModule,
    AuditModule,
    NotificationModule,
    FileModule,
    WebhookModule,
    HealthModule,
    CrmModule
  ]
})
export class AppModule {}