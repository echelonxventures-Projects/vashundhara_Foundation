'use client';
import { api, post, refreshSession } from '@vashundhara-foundation/ui';
import { hasPermission } from '@vashundhara-foundation/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export interface Me { user: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean; isSystemAdmin: boolean; mfaEnabled: boolean; organizationId: string | null } | null; roles: string[]; permissions: string[]; tenant: { id: string; slug: string; name: string } | null; memberships: { slug: string; name: string; url: string }[] }
interface Ctx { me: Me | null; loading: boolean; reload: () => Promise<Me | null>; logout: () => Promise<void>; can: (p: string) => boolean }
const C = createContext<Ctx>({ me: null, loading: true, reload: async () => null, logout: async () => undefined, can: () => false });
const HINT = 'vf_signed_in';
const hint = { get: () => { try { return localStorage.getItem(HINT) === '1'; } catch { return false; } }, set: (v: boolean) => { try { if (v) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* private mode */ } } };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      let m = await api<Me>('auth/session');
      // The short-lived cookie may have lapsed while the long-lived one is still good.
      if (!m.user && hint.get() && (await refreshSession())) m = await api<Me>('auth/session');
      hint.set(Boolean(m.user));
      setMe(m);
      return m;
    } catch { return null; } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const logout = async () => { await post('auth/logout').catch(() => undefined); hint.set(false); setMe((m) => (m ? { ...m, user: null, roles: [], permissions: [] } : null)); };
  const can = (p: string) => hasPermission(me?.permissions ?? [], p);
  return <C.Provider value={{ me, loading, reload, logout, can }}>{children}</C.Provider>;
}
export const useSession = () => useContext(C);
