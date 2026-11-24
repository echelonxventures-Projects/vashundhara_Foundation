'use client';
import { Feedback, Notice, post, useAction, useApi } from '@vashundhara-foundation/ui';
import { useCallback, useEffect, useState } from 'react';
import { TextArea, TextField, values } from './forms';
import { useSession } from './session';

type Item = { clientId: string; type: 'visit' | 'attendance'; data: Record<string, unknown>; error?: string };
const DB = 'vf-field';
function store<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => {
    const o = indexedDB.open(DB, 1);
    o.onupgradeneeded = () => o.result.createObjectStore('queue', { keyPath: 'clientId' });
    o.onerror = () => no(o.error);
    o.onsuccess = () => { const tx = o.result.transaction('queue', mode); const r = fn(tx.objectStore('queue')); tx.oncomplete = () => { ok(r.result); o.result.close(); }; tx.onerror = () => no(tx.error); };
  });
}
const locate = () => new Promise<{ latitude?: number; longitude?: number; accuracyM?: number }>((ok) => { if (!navigator.geolocation) return ok({}); navigator.geolocation.getCurrentPosition((p) => ok({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }), () => ok({}), { enableHighAccuracy: true, timeout: 10_000 }); });

/** Everything is saved on the device first, then sent when there is a connection. */
export function FieldApp() {
  const { me, can } = useSession();
  const [queue, setQueue] = useState<Item[]>([]);
  const [online, setOnline] = useState(true);
  const people = useApi(can('beneficiaries:read') ? 'beneficiaries?limit=100' : null);
  const a = useAction();
  const owner = me?.user?.id;
  const load = useCallback(async () => setQueue(await store<Item[]>('readonly', (s) => s.getAll() as IDBRequest<Item[]>)), []);
  const sync = useCallback(async () => {
    const items = (await store<Item[]>('readonly', (s) => s.getAll() as IDBRequest<Item[]>)).filter((i) => i.data.owner === owner);
    if (!items.length || !navigator.onLine || !owner) return;
    const strip = ({ clientId, data }: Item) => { const { owner: _o, ...d } = data; return { ...d, clientId }; };
    const r = await post<{ accepted: string[]; rejected: { clientId: string; message: string }[] }>('field/sync', { visits: items.filter((i) => i.type === 'visit').slice(0, 100).map(strip), attendance: items.filter((i) => i.type === 'attendance').slice(0, 100).map(strip) });
    for (const id of r.accepted) await store('readwrite', (s) => s.delete(id));
    for (const x of r.rejected) { const i = items.find((y) => y.clientId === x.clientId); if (i) await store('readwrite', (s) => s.put({ ...i, error: x.message })); }
    await load();
  }, [load, owner]);
  useEffect(() => {
    void load();
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    const on = () => { setOnline(true); void sync().catch(() => undefined); };
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load, sync]);
  const add = async (type: Item['type'], data: Record<string, unknown>) => { await store('readwrite', (s) => s.put({ clientId: crypto.randomUUID(), type, data: { ...data, owner } })); await load(); await sync().catch(() => undefined); };
  const attend = (kind: 'IN' | 'OUT') => a.run(async () => { const { accuracyM: _a, ...g } = await locate(); await add('attendance', { kind, ...g, recordedAt: new Date().toISOString() }); }, 'Saved');
  return (
    <div className="mx-auto max-w-lg px-4 py-8"><h1 className="mb-4 text-2xl font-bold">Field app</h1>
      <Notice kind={online ? 'ok' : 'info'}>{online ? 'Online' : 'Offline. Entries are kept on this phone.'} {queue.length > 0 && `${queue.length} waiting to send.`}</Notice>
      {!owner ? <Notice>Sign in while online to send entries.</Notice> : <>
        <Feedback action={a} /><div className="mb-6 flex gap-3"><button className="btn btn-primary flex-1" disabled={a.busy} onClick={() => attend('IN')}>Start day</button><button className="btn btn-outline flex-1" disabled={a.busy} onClick={() => attend('OUT')}>End day</button></div>
        <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); void a.run(async () => { await add('visit', { purpose: v.purpose, notes: v.notes, beneficiaryId: v.beneficiaryId, ...(await locate()), visitedAt: new Date().toISOString() }); f.reset(); }, 'Visit saved'); }}>
          <h2 className="mb-3 text-xl font-semibold">New visit</h2><TextField name="purpose" label="Purpose" required maxLength={200} />
          <div className="field"><label htmlFor="ben">Beneficiary</label><select id="ben" name="beneficiaryId"><option value="">-</option>{people.data?.items.map((b: any) => <option key={b.id} value={b.id}>{b.fullName}</option>)}</select></div>
          <TextArea name="notes" label="Notes" maxLength={3000} /><button className="btn btn-primary w-full" disabled={a.busy}>Save visit</button></form>
        {queue.length > 0 && <><h2 className="mb-2 mt-6 font-semibold">Waiting to send</h2><ul>{queue.map((q) => <li key={q.clientId}>{q.type}: {String(q.data.purpose ?? q.data.kind)} {q.error && <span className="text-danger">{q.error}</span>} {q.error && <button className="underline" onClick={async () => { await store('readwrite', (s) => s.delete(q.clientId)); await load(); }}>Remove</button>}</li>)}</ul><button className="btn btn-outline mt-3" onClick={() => a.run(sync)}>Send now</button></>}
      </>}
    </div>
  );
}
