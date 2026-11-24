'use client';
import { useTranslations } from 'next-intl';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { const t = useTranslations('common'); return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-2xl font-bold">{t('error')}</h1><button className="btn btn-primary mt-4" onClick={reset}>{t('tryAgain')}</button></div>; }
