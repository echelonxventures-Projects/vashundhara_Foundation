import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, Env } from '../../env';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  readonly client: Redis;
  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
    this.client.on('error', (e) => console.error(JSON.stringify({ level: 'error', msg: 'redis', error: e.message })));
  }
  async onApplicationShutdown() {
    this.client.disconnect();
  }
  async cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.client.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
    const value = await load();
    await this.client.set(key, JSON.stringify(value ?? null), 'EX', ttl);
    return value;
  }
  async del(...keys: string[]) {
    if (keys.length) await this.client.del(...keys);
  }
  /** Fixed-window counter. Returns the count so far in this window. */
  async hit(key: string, windowSec: number): Promise<number> {
    const [[, n]] = (await this.client.multi().incr(key).expire(key, windowSec, 'NX').exec()) as [[unknown, number], unknown];
    return n;
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
