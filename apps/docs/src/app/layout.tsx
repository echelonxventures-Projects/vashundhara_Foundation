import '@vashundhara-foundation/ui/src/styles.css';
import Link from 'next/link';
import { pages } from '../lib';
export const metadata = { title: 'NGO platform guide' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[220px_1fr]"><nav aria-label="Guide"><ul className="grid gap-1">{pages().map((p) => <li key={p.slug}><Link className="hover:underline" href={`/${p.slug}`}>{p.title}</Link></li>)}</ul></nav><main className="prose min-w-0">{children}</main></div></body></html>;
}
