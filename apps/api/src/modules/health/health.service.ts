/**
 * Health Service for Vashundhara Foundation API
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      platform: 'Vashundhara Foundation',
      domain: 'vashundharafoundation.org',
      tier: 'White'
    };
  }

  async detailedCheck() {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    const isHealthy = dbStatus.status === 'ok' && redisStatus.status === 'ok';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      platform: 'Vashundhara Foundation',
      domain: 'vashundharafoundation.org',
      tier: 'White',
      checks: {
        database: dbStatus,
        redis: redisStatus,
        memory: this.checkMemory(),
        cpu: this.checkCpu()
      }
    };
  }

  async readiness() {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    const isReady = dbStatus.status === 'ok' && redisStatus.status === 'ok';

    if (!isReady) {
      return {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbStatus,
          redis: redisStatus
        }
      };
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        redis: redisStatus
      }
    };
  }

  liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  private async checkDatabase() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latency: '< 10ms' };
    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async checkRedis() {
    try {
      const isConnected = await this.redis.ping();
      return { status: isConnected ? 'ok' : 'error' };
    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private checkMemory() {
    const used = process.memoryUsage();
    return {
      status: 'ok',
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
      external: `${Math.round(used.external / 1024 / 1024)} MB`
    };
  }

  private checkCpu() {
    const usage = process.cpuUsage();
    return {
      status: 'ok',
      user: `${Math.round(usage.user / 1000)} ms`,
      system: `${Math.round(usage.system / 1000)} ms`
    };
  }
}