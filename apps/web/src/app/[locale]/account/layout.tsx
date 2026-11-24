import { AccountShell } from '@/components/account';
export const metadata = { robots: { index: false } };
export default function L({ children }: { children: React.ReactNode }) { return <AccountShell>{children}</AccountShell>; }
