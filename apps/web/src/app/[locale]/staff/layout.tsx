import { StaffShell } from '@/components/staff';
export const metadata = { robots: { index: false } };
export default function L({ children }: { children: React.ReactNode }) { return <StaffShell>{children}</StaffShell>; }
