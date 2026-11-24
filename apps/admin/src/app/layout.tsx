import '@vashundhara-foundation/ui/src/styles.css';
import { Console } from '@/console';
export const metadata = { title: 'Platform console', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><Console>{children}</Console></body></html>; }
