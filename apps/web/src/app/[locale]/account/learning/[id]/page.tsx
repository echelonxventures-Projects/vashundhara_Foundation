import { CourseView } from '@/components/account';
export default async function P({ params }: { params: Promise<{ id: string }> }) { return <CourseView id={(await params).id} />; }
