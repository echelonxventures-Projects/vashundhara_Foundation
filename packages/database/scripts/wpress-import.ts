import { createWriteStream, mkdirSync, openSync, readSync, writeFileSync } from 'fs';
import { basename, extname, join, resolve } from 'path';

/**
 * Reads an All-in-One WP Migration archive as plain data. No code from it is ever run or copied.
 * Takes published pages, published posts and media only. Users, comments, orders and form entries are skipped.
 *
 *   pnpm import:wordpress <file.wpress> <output folder> [--load <ngo address>]
 *
 * --load also saves the text as DRAFT pages in the database named by DATABASE_URL.
 */
const HEADER = 4377;
const MEDIA = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.mp4', '.mp3']);
const args = process.argv.slice(2);
const loadAt = args.indexOf('--load');
const slug = loadAt >= 0 ? args.splice(loadAt, 2)[1] : undefined;
const [file, outArg] = args;
if (!file || !outArg) throw new Error('Usage: import:wordpress <file.wpress> <output folder> [--load <ngo address>]');
const out = resolve(outArg);
const text = (b: Buffer) => b.subarray(0, b.indexOf(0) < 0 ? b.length : b.indexOf(0)).toString('utf8');

interface Post { slug: string; title: string; excerpt: string; body: string; kind: 'page' | 'post'; date: string }

/** Parses the VALUES of one INSERT statement. MySQL escapes are handled; nothing is executed. */
export function parseValues(sql: string): (string | null)[][] {
  const rows: (string | null)[][] = [];
  let i = sql.indexOf('VALUES') + 6;
  while (i < sql.length) {
    while (i < sql.length && sql[i] !== '(') i++;
    if (i >= sql.length) break;
    i++;
    const row: (string | null)[] = [];
    for (;;) {
      while (sql[i] === ' ') i++;
      if (sql[i] === "'") {
        let s = '';
        i++;
        while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) {
          if (sql[i] === '\\') { const e = sql[i + 1]; s += ({ n: '\n', r: '\r', t: '\t', '0': '' } as Record<string, string>)[e] ?? e; i += 2; }
          else if (sql[i] === "'") { s += "'"; i += 2; }
          else s += sql[i++];
        }
        i++;
        row.push(s);
      } else {
        const start = i;
        while (i < sql.length && sql[i] !== ',' && sql[i] !== ')') i++;
        const v = sql.slice(start, i).trim();
        row.push(v === 'NULL' ? null : v);
      }
      if (sql[i] === ',') { i++; continue; }
      i++;
      break;
    }
    rows.push(row);
  }
  return rows;
}
/** Drops scripts, styles, editor comments and shortcodes. The website sanitises again when showing it. */
export const cleanBody = (html: string) => html.replace(/<(script|style|iframe|form|object|embed)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\[\/?[a-z][\w-]*(?:\s[^\]]*)?\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();

/** WordPress samples and donation-plugin screens that mean nothing here. */
const SKIP = new Set(['hello-world', 'sample-page', 'donation-confirmation', 'donation-failed', 'donor-dashboard']);
const COLUMNS = ['ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content', 'post_title', 'post_excerpt', 'post_status', 'comment_status', 'ping_status', 'post_password', 'post_name', 'to_ping', 'pinged', 'post_modified', 'post_modified_gmt', 'post_content_filtered', 'post_parent', 'guid', 'menu_order', 'post_type'];
function readPosts(sql: string): Post[] {
  const posts: Post[] = [];
  let pos = 0;
  while ((pos = sql.indexOf('INSERT INTO `', pos)) >= 0) {
    const end = sql.indexOf(';\n', pos);
    const stmt = sql.slice(pos, end < 0 ? undefined : end);
    pos = end < 0 ? sql.length : end;
    if (!/^INSERT INTO `[^`]*_posts`/.test(stmt)) continue;
    const named = /^INSERT INTO `[^`]*` \(([^)]*)\) VALUES/.exec(stmt)?.[1].split(',').map((c) => c.replace(/[` ]/g, ''));
    const cols = named ?? COLUMNS;
    for (const row of parseValues(stmt)) {
      const r = Object.fromEntries(cols.map((c, n) => [c, row[n] ?? '']));
      const s = r.post_name?.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100).replace(/^-+|-+$/g, '');
      if (r.post_status !== 'publish' || r.post_password || !['page', 'post'].includes(r.post_type!) || !s || SKIP.has(s)) continue;
      posts.push({ slug: s, title: r.post_title!.slice(0, 200) || s, excerpt: r.post_excerpt!.slice(0, 500), body: cleanBody(r.post_content!), kind: r.post_type as 'page' | 'post', date: r.post_date_gmt! });
    }
  }
  return posts;
}

async function main() {
  mkdirSync(join(out, 'media'), { recursive: true });
  const fd = openSync(file, 'r');
  const head = Buffer.alloc(HEADER);
  let at = 0;
  let media = 0;
  let database = '';
  for (;;) {
    if (readSync(fd, head, 0, HEADER, at) < HEADER || head.every((b) => b === 0)) break;
    const name = text(head.subarray(0, 255));
    const size = Number(text(head.subarray(255, 269)));
    const folder = text(head.subarray(281, HEADER));
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('The archive is damaged');
    at += HEADER;
    if (folder === '.' && name === 'database.sql') {
      const b = Buffer.alloc(size);
      readSync(fd, b, 0, size, at);
      database = b.toString('utf8');
    } else if (folder.startsWith('uploads/20') && MEDIA.has(extname(name).toLowerCase()) && !/-\d+x\d+\.\w+$/.test(name) && size < 25 * 1024 * 1024) {
      // The name is flattened, so an archive cannot write outside the output folder.
      const safe = `${folder.replace(/[^\w]/g, '-')}-${basename(name).replace(/[^\w.-]/g, '_')}`;
      const w = createWriteStream(join(out, 'media', safe));
      for (let left = size, p = at; left > 0; ) { const chunk = Buffer.alloc(Math.min(left, 1 << 20)); readSync(fd, chunk, 0, chunk.length, p); if (!w.write(chunk)) await new Promise((r) => w.once('drain', r)); left -= chunk.length; p += chunk.length; }
      await new Promise<void>((r) => w.end(r));
      media++;
    }
    at += size;
  }
  const posts = readPosts(database);
  writeFileSync(join(out, 'pages.json'), JSON.stringify(posts, null, 2));
  writeFileSync(join(out, 'redirects.csv'), ['fromPath,toPath', ...posts.map((p) => `/${p.slug},/en/${p.kind === 'post' ? 'blog/' : ''}${p.slug}`)].join('\n'));
  console.log(`${posts.filter((p) => p.kind === 'page').length} pages, ${posts.filter((p) => p.kind === 'post').length} posts and ${media} media files in ${out}`);
  if (!slug) return;
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  const t = await db.tenant.findUniqueOrThrow({ where: { slug } });
  let added = 0;
  for (const p of posts) {
    if (!p.body) continue;
    if (await db.page.findFirst({ where: { tenantId: t.id, slug: p.slug, locale: 'en' } })) continue;
    await db.page.create({ data: { tenantId: t.id, slug: p.slug, title: p.title, excerpt: p.excerpt || null, body: p.body, kind: p.kind, status: 'DRAFT' } });
    const fromPath = `/${p.slug}`;
    const toPath = `/en/${p.kind === 'post' ? 'blog/' : ''}${p.slug}`;
    if (p.kind === 'post' && !(await db.redirect.findFirst({ where: { tenantId: t.id, fromPath } }))) await db.redirect.create({ data: { tenantId: t.id, fromPath, toPath } });
    added++;
  }
  console.log(`${added} saved as drafts for ${slug}. Review them under Staff, Pages and stories.`);
  await db.$disconnect();
}
main().catch((e) => { console.error((e as Error).message); process.exitCode = 1; });
