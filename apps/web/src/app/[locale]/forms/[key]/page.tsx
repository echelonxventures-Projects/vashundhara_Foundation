import { notFound } from 'next/navigation';
import { OwnForm } from '@/components/public-forms';
import { getTenant } from '@/lib/server';
export const metadata = { robots: { index: false } };
export default async function Form({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) notFound();
  const t = await getTenant();
  return <div className="mx-auto max-w-2xl px-4 py-10"><OwnForm formKey={key} org={t?.name ?? ''} /></div>;
}
