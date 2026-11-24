import { isLocale, Messages, withFallback } from '@vashundhara-foundation/i18n';
import { getRequestConfig } from 'next-intl/server';
import { serverApi } from '@/lib/server';

export default getRequestConfig(async ({ requestLocale }) => {
  const wanted = (await requestLocale) ?? 'en';
  const locale = isLocale(wanted) ? wanted : 'en';
  const load = async (l: string) => (await import(`../../../../packages/i18n/locales/${l}.json`)).default as Messages;
  const en = await load('en');
  let messages = locale === 'en' ? en : withFallback(en, await load(locale));
  // An NGO's own wording wins.
  const own = await serverApi<Record<string, string>>(`translations/public?locale=${locale}`);
  if (own && Object.keys(own).length) {
    const tree: Messages = {};
    for (const [k, v] of Object.entries(own)) {
      const parts = k.split('.');
      if (parts.some((p) => p === '__proto__' || p === 'constructor')) continue;
      let node = tree;
      parts.slice(0, -1).forEach((p) => { node = (node[p] = typeof node[p] === 'object' ? (node[p] as Messages) : {}) as Messages; });
      node[parts[parts.length - 1]] = v;
    }
    messages = withFallback(messages, tree);
  }
  return { locale, messages, timeZone: 'Asia/Kolkata' };
});
