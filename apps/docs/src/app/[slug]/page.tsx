import { notFound } from 'next/navigation';
import { pages } from '../../lib';
export const dynamicParams = false;
export const generateStaticParams = () => pages().map((p) => ({ slug: p.slug }));
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = pages().find((x) => x.slug === slug);
  if (!p) notFound();
  return <div dangerouslySetInnerHTML={{ __html: p.html }} />;
}
