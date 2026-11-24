import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from './common/audit/audit.service';
import { ContextMiddleware, TenantResolver } from './common/http/context.middleware';
import { ErrorsFilter } from './common/http/errors.filter';
import { AuthGuard, RateGuard } from './common/http/guards';
import { JobsModule } from './common/jobs/jobs.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { ENV, Env, loadEnv } from './env';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { CrmModule } from './modules/crm/crm.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FilesModule } from './modules/files/files.module';
import { FinanceModule } from './modules/finance/finance.module';
import { FundraisingModule } from './modules/fundraising/fundraising.module';
import { LearningModule } from './modules/learning/learning.module';
import { MembersModule } from './modules/members/members.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ProgrammesModule } from './modules/programmes/programmes.module';
import { SystemModule } from './modules/system/system.module';

@Global()
@Module({ providers: [{ provide: ENV, useFactory: () => loadEnv() }, TenantResolver], exports: [ENV, TenantResolver] })
class CoreModule {}

@Module({
  imports: [
    CoreModule, PrismaModule, RedisModule, AuditModule, JobsModule,
    JwtModule.registerAsync({
      global: true, inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { issuer: 'vf', audience: 'vf', algorithm: 'HS256' }, verifyOptions: { issuer: 'vf', audience: 'vf', algorithms: ['HS256'] } })
    }),
    NotificationsModule, AuthModule, FilesModule, MembersModule, SystemModule, FundraisingModule, FinanceModule, CrmModule,
    ProgrammesModule, LearningModule, EngagementModule, ContentModule, PrivacyModule, PlatformModule
  ],
  providers: [{ provide: APP_GUARD, useClass: RateGuard }, { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: ErrorsFilter }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('{*path}');
  }
}
