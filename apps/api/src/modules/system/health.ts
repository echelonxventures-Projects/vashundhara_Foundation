import { Controller, Get, Inject, Module, Req, Res, ServiceUnavailableException, UnauthorizedException, VERSION_NEUTRAL } from '@nestjs/common';
import { safeEqual } from '@vashundhara-foundation/auth';
import type { Request, Response } from 'express';
import * as prom from 'prom-client';
import { ENV, Env } from '../../env';
import { Public } from '../../common/http/decorators';
import { runAsSystem } from '../../common/context/context';
import { PrismaService } from '../../common/prisma/prisma.module';
import { RedisService } from '../../common/redis/redis.module';

export const httpDuration = new prom.Histogram({ name: 'http_request_duration_seconds', help: 'HTTP latency', labelNames: ['method', 'route', 'status'], buckets: [0.01, 0.05, 0.1, 0.3, 1, 3, 10] });
const jobs = new prom.Gauge({ name: 'jobs_total', help: 'Jobs by status', labelNames: ['status'] });

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, @Inject(ENV) private readonly env: Env) {}
  @Get('health/live') @Public()
  live() { return { status: 'ok' }; }
  /** Checks what the service really needs, so a broken pod stops receiving traffic. */
  @Get(['health', 'health/ready']) @Public()
  async ready() {
    const limit = <T>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]);
    const [db, cache] = await Promise.allSettled([limit(this.prisma.$queryRaw`SELECT 1`), limit(this.redis.client.ping())]);
    const body = { status: db.status === 'fulfilled' && cache.status === 'fulfilled' ? 'ok' : 'unavailable', database: db.status === 'fulfilled', redis: cache.status === 'fulfilled' };
    if (body.status !== 'ok') throw new ServiceUnavailableException({ message: 'Not ready', details: body });
    return body;
  }
  @Get('metrics') @Public()
  async metrics(@Req() req: Request, @Res() res: Response) {
    const token = this.env.METRICS_TOKEN;
    if (!token ? this.env.NODE_ENV === 'production' : !safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) throw new UnauthorizedException();
    jobs.reset();
    for (const g of await runAsSystem(async () => this.prisma.job.groupBy({ by: ['status'], _count: true }))) jobs.set({ status: g.status }, g._count);
    res.type(prom.register.contentType).send(await prom.register.metrics());
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
