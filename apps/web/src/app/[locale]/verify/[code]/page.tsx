import { getTranslations } from 'next-intl/server';
import { Narrow } from '@/components/cards';
import { serverApi } from '@/lib/server';
export default async function Verify({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [t, c] = await Promise.all([getTranslations('volunteer'), serverApi<{ valid: boolean; title: string; hours: number; name: string; organisation: string }>(`volunteering/certificates/${encodeURIComponent(code)}/verify`)]);
  return <Narrow title={t('verify')}>{c?.valid ? <div className="notice notice-ok"><p className="font-semibold">{t('valid')}</p><p>{t('awarded', { title: c.title, hours: c.hours, name: c.name, org: c.organisation })}</p></div> : <div className="notice notice-error">{t('invalid')}</div>}</Narrow>;
}
