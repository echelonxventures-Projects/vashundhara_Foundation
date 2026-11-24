import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';
const DIR = join(process.cwd(), 'content');
export const pages = () => readdirSync(DIR).filter((f) => f.endsWith('.md')).sort().map((f) => { const body = readFileSync(join(DIR, f), 'utf8'); return { slug: f.replace(/^\d+-|\.md$/g, ''), title: /^# (.+)$/m.exec(body)?.[1] ?? f, html: marked.parse(body, { async: false }) as string }; });
