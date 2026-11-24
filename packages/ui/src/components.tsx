'use client';
import { ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from './api';

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const n = ++latest.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (n === latest.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === latest.current) setError(e as ApiError);
    } finally {
      if (n === latest.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}

/** Runs an action once at a time and keeps its message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    if (busy) return false;
    setBusy(true); setError(null); setDone(null);
    try { await fn(); if (success) setDone(success); return true; } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, { code: 'ERROR', message: 'Something went wrong. Please try again.' }));
      return false;
    } finally { setBusy(false); }
  };
  return { busy, error, done, run };
}

export const Notice = ({ kind = 'info', children }: { kind?: 'info' | 'error' | 'ok'; children: ReactNode }) => (
  <div role={kind === 'error' ? 'alert' : 'status'} className={`notice notice-${kind}`}>{children}</div>
);
export const Feedback = ({ action }: { action: ReturnType<typeof useAction> }) => (
  <div aria-live="polite">
    {action.error && <Notice kind="error">{action.error.message}{action.error.body.details?.length ? <ul className="mt-1 list-disc ps-5">{action.error.body.details.map((d) => <li key={d.path + d.message}>{d.path ? `${d.path}: ` : ''}{d.message}</li>)}</ul> : null}</Notice>}
    {action.done && <Notice kind="ok">{action.done}</Notice>}
  </div>
);
export const Loading = ({ label = 'Loading' }: { label?: string }) => <div className="py-10 text-center text-muted" role="status"><span className="spinner" aria-hidden="true" /> {label}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <p className="py-10 text-center text-muted">{children}</p>;

export function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => ReactNode }) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true" className="text-danger"> *</span>}</label>
      {children({ id, required, 'aria-describedby': note ? `${id}-n` : undefined, 'aria-invalid': error ? true : undefined })}
      {note && <p id={`${id}-n`} className={error ? 'field-error' : 'field-hint'}>{note}</p>}
    </div>
  );
}

export function Dialog({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={id} onClose={onClose} className="dialog">
      <div className="flex items-start justify-between gap-4"><h2 id={id} className="text-xl font-semibold">{title}</h2><button type="button" className="btn btn-ghost" aria-label="Close" onClick={onClose}>✕</button></div>
      {open && <div className="mt-4">{children}</div>}
    </dialog>
  );
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages < 2) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
      <button className="btn btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      <span className="text-sm text-muted">{page} / {pages}</span>
      <button className="btn btn-outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
    </nav>
  );
}

export interface Column { key: string; label: string; render?: (row: any) => ReactNode }
export function Table({ columns, rows, actions, caption }: { columns: Column[]; rows: any[]; actions?: (row: any) => ReactNode; caption: string }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}{actions && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : show(r[c.key])}</td>)}{actions && <td className="whitespace-nowrap text-end">{actions(r)}</td>}</tr>)}</tbody>
      </table>
    </div>
  );
}
function show(v: unknown): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-muted">-</span>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) return new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  if (typeof v === 'string' && /^[A-Z][A-Z0-9_]+$/.test(v)) return <Badge value={v} />;
  return String(v);
}
const GOOD = /^(ACTIVE|COMPLETED|APPROVED|PUBLISHED|PAID|CLEAN|ATTENDED|ISSUED|SENT|GRADED|DONE|DELIVERED)$/;
const BAD = /^(FAILED|REJECTED|SUSPENDED|CANCELLED|VOID|INFECTED|DEAD|BLACKLISTED|OVERDUE)$/;
export const Badge = ({ value }: { value: string }) => <span className={`badge ${GOOD.test(value) ? 'badge-ok' : BAD.test(value) ? 'badge-bad' : ''}`}>{value.replace(/_/g, ' ').toLowerCase()}</span>;
