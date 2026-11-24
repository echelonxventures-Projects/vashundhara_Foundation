import 'server-only';
import { marked } from 'marked';
import sanitize from 'sanitize-html';
/** CMS text is written by NGO staff, so it is always sanitised before display. */
export function renderMarkdown(src: string): string {
  return sanitize(marked.parse(src, { async: false }) as string, {
    allowedTags: ['h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'code', 'pre', 'hr', 'br', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption'],
    allowedAttributes: { a: ['href', 'title', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'] }, allowedSchemes: ['https', 'mailto', 'tel'], allowProtocolRelative: false,
    transformTags: { h1: 'h2', a: sanitize.simpleTransform('a', { rel: 'noopener nofollow' }), img: sanitize.simpleTransform('img', { loading: 'lazy' }) }
  });
}
