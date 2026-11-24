import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ALL_PERMISSIONS } from '@vashundhara-foundation/shared';
import { expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { PERMISSIONS, PLATFORM, PUBLIC, SELF } from './decorators';

function controllers(mod: any, seen = new Set<any>()): any[] {
  const m = mod?.module ?? mod;
  if (!m || seen.has(m)) return [];
  seen.add(m);
  const own = Reflect.getMetadata('controllers', m) ?? [];
  return [...own, ...(Reflect.getMetadata('imports', m) ?? []).flatMap((i: any) => controllers(i, seen))];
}
it('every route has an access rule, and only known permissions are used', () => {
  let routes = 0;
  for (const c of controllers(AppModule)) {
    for (const name of Object.getOwnPropertyNames(c.prototype)) {
      const h = Object.getOwnPropertyDescriptor(c.prototype, name)?.value;
      if (name === 'constructor' || typeof h !== 'function' || Reflect.getMetadata(PATH_METADATA, h) === undefined) continue;
      routes++;
      const get = (k: string) => Reflect.getMetadata(k, h) ?? Reflect.getMetadata(k, c);
      expect(Boolean(get(PUBLIC) || get(PERMISSIONS) || get(SELF) || get(PLATFORM)), `${c.name}.${name}`).toBe(true);
      for (const p of get(PERMISSIONS) ?? []) expect(ALL_PERMISSIONS).toContain(p);
    }
  }
  expect(routes).toBeGreaterThan(200);
});
