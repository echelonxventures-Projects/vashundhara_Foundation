import { Global, Inject, Injectable, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Job, Prisma } from '@prisma/client';
import { ENV, Env } from '../../env';
import { runAsSystem, runAsTenant } from '../context/context';
import { TenantResolver } from '../http/context.middleware';
import { PrismaService } from '../prisma/prisma.module';

/** Throw this when retrying cannot help. */
export class PermanentJobError extends Error {}
type Handler = (payload: any, job: Job) => Promise<void>;
type Tx = Pick<PrismaService, 'job'>;

@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly handlers = new Map<string, Handler>();
  private readonly schedules: { name: string; everySec: number }[] = [];
  private stopped = false;
  private loop?: Promise<void>;
  private wake?: () => void;

  constructor(private readonly prisma: PrismaService, private readonly tenants: TenantResolver, @Inject(ENV) private readonly env: Env) {}

  register(type: string, handler: Handler) { this.handlers.set(type, handler); }
  /** Runs once per interval across all instances. */
  every(everySec: number, type: string, handler: Handler) {
    this.register(type, handler);
    this.schedules.push({ name: type, everySec });
  }

  /** Pass the transaction client so the job only exists if the change commits. */
  async enqueue(type: string, payload: Prisma.InputJsonValue, opts: { tx?: Tx; tenantId?: string; dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {}) {
    const db = opts.tx ?? this.prisma;
    const data = { type, payload, tenantId: opts.tenantId, dedupeKey: opts.dedupeKey, runAt: opts.runAt, maxAttempts: opts.maxAttempts };
    if (opts.dedupeKey) await db.job.createMany({ data: [data], skipDuplicates: true });
    else await db.job.create({ data });
  }

  onApplicationBootstrap() {
    if (this.env.WORKER_ENABLED) this.loop = this.run();
  }
  async onApplicationShutdown() {
    this.stopped = true;
    this.wake?.();
    await this.loop;
  }

  private async run() {
    while (!this.stopped) {
      let worked = false;
      try {
        await this.tick();
        worked = await this.runOne();
      } catch (e) {
        console.error(JSON.stringify({ level: 'error', msg: 'worker', error: (e as Error).message }));
      }
      if (!worked && !this.stopped) {
        await new Promise<void>((r) => { const t = setTimeout(r, 1000); this.wake = () => { clearTimeout(t); r(); }; });
      }
    }
  }

  private lastTick = 0;
  private async tick() {
    if (Date.now() - this.lastTick < 15_000) return;
    this.lastTick = Date.now();
    for (const s of this.schedules) {
      await this.enqueue(s.name, {}, { dedupeKey: `cron:${s.name}:${Math.floor(Date.now() / 1000 / s.everySec)}`, maxAttempts: 2 });
    }
    await this.prisma.job.deleteMany({ where: { status: 'DONE', finishedAt: { lt: new Date(Date.now() - 7 * 86400_000) } } });
  }

  /** Exposed so tests can drain the queue deterministically. */
  async runOne(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE jobs SET status = 'RUNNING', "lockedAt" = now(), attempts = attempts + 1
      WHERE id = (SELECT id FROM jobs
        WHERE (status = 'QUEUED' AND "runAt" <= now()) OR (status = 'RUNNING' AND "lockedAt" < now() - interval '10 minutes')
        ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id`;
    if (!rows.length) return false;
    const job = await this.prisma.job.findUniqueOrThrow({ where: { id: rows[0].id } });
    const handler = this.handlers.get(job.type);
    try {
      if (!handler) throw new PermanentJobError(`No handler for ${job.type}`);
      if (job.attempts > job.maxAttempts) throw new PermanentJobError('Worker died repeatedly');
      if (job.tenantId) {
        const tenant = await this.tenants.byId(job.tenantId);
        if (!tenant) throw new PermanentJobError('Organisation no longer exists');
        await runAsTenant(tenant, () => handler(job.payload, job));
      } else {
        await runAsSystem(() => handler(job.payload, job));
      }
      await this.prisma.job.update({ where: { id: job.id }, data: { status: 'DONE', finishedAt: new Date(), lastError: null } });
    } catch (e) {
      const dead = e instanceof PermanentJobError || job.attempts >= job.maxAttempts;
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: dead ? 'DEAD' : 'QUEUED', lastError: String((e as Error).message).slice(0, 1000), lockedAt: null,
          finishedAt: dead ? new Date() : null, runAt: new Date(Date.now() + Math.min(3600, 10 * 3 ** job.attempts) * 1000)
        }
      });
    }
    return true;
  }
}

@Global()
@Module({ providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
