import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScope } from './tenant-scope';

/** Injection token and type. The value is the tenant-scoped client. */
export abstract class PrismaService extends PrismaClient {}

@Global()
@Module({
  providers: [{ provide: PrismaService, useFactory: () => new PrismaClient({ errorFormat: 'minimal' }).$extends(tenantScope) }],
  exports: [PrismaService]
})
export class PrismaModule implements OnApplicationShutdown {
  constructor(private readonly prisma: PrismaService) {}
  async onApplicationShutdown() {
    await this.prisma.$disconnect();
  }
}
