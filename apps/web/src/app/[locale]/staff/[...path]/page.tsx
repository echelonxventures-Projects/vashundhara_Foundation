import { StaffPage } from '@/components/staff';
export default async function P({ params }: { params: Promise<{ path: string[] }> }) { return <StaffPage path={(await params).path} />; }
