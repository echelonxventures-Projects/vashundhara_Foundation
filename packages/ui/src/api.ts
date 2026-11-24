export interface ApiErrorBody { code: string; message: string; details?: { path: string; message: string }[] }
export class ApiError extends Error {
  constructor(readonly status: number, readonly body: ApiErrorBody) { super(body.message); }
  get code() { return this.body.code; }
  field(path: string) { return this.body.details?.find((d) => d.path === path)?.message; }
}

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', headers: { 'x-requested-with': 'vf' } })
    .then((r) => r.ok).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}, retry = true): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/${path}`, {
      method: opts.method ?? 'GET', headers: { 'x-requested-with': 'vf', ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new ApiError(0, { code: 'OFFLINE', message: 'You appear to be offline. Please try again.' });
  }
  if (r.status === 401 && retry && !path.startsWith('auth/login') && !path.startsWith('auth/refresh') && (await refreshSession())) return api<T>(path, opts, false);
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, json?.error ?? { code: 'ERROR', message: 'Something went wrong. Please try again.' });
  return json as T;
}
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const put = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export function saveText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([type.startsWith('text/csv') ? `\uFEFF${text}` : text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Uploads straight to storage, then waits for the virus scan. */
export async function uploadFile(file: File, isPublic = false): Promise<string> {
  const { id, upload } = await post<{ id: string; upload: { url: string; fields: Record<string, string> } }>('files/uploads', { filename: file.name, mimeType: file.type, size: file.size, isPublic });
  const form = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
  form.append('file', file);
  const r = await fetch(upload.url, { method: 'POST', body: form });
  if (!r.ok) throw new ApiError(r.status, { code: 'UPLOAD', message: 'The upload failed. Please try again.' });
  await post(`files/uploads/${id}/complete`);
  return id;
}
