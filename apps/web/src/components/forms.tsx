'use client';
import { Field } from '@vashundhara-foundation/ui';
import { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function TextField({ label, hint, error, ...p }: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} hint={hint} error={error} required={p.required}>{(a) => <input {...p} {...a} />}</Field>;
}
export function TextArea({ label, hint, error, ...p }: { label: string; hint?: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} hint={hint} error={error} required={p.required}>{(a) => <textarea rows={4} {...p} {...a} />}</Field>;
}
export function Check({ label, hint, ...p }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="check"><input type="checkbox" {...p} /><span>{label}{hint && <span className="field-hint block">{hint}</span>}</span></label>;
}
/** Reads a form as plain strings; empty values are dropped. */
export const values = (f: HTMLFormElement): Record<string, string> => Object.fromEntries([...new FormData(f).entries()].filter(([, v]) => typeof v === 'string' && v.trim() !== '').map(([k, v]) => [k, String(v).trim()]));
