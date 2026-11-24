import { getTranslations } from 'next-intl/server';
import { Narrow } from '@/components/cards';
import { ContactForm } from '@/components/public-forms';
export const generateMetadata = async () => ({ title: (await getTranslations('contact'))('title') });
export default async function Contact() { const t = await getTranslations('contact'); return <Narrow title={t('title')}><ContactForm /></Narrow>; }
