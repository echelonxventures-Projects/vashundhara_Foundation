import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import bidiFactory from 'bidi-js';
import PDFDocument from 'pdfkit';
import type { Hb, HbFont } from './harfbuzz';

const DIR = join(__dirname, '../../../assets/fonts');
/** Script to font. Anything else falls back to Noto Sans, which covers Latin, Greek and Cyrillic. */
const SCRIPTS: [RegExp, string][] = [
  [/\p{Script=Devanagari}/u, 'NotoSansDevanagari'], [/\p{Script=Bengali}/u, 'NotoSansBengali'], [/\p{Script=Tamil}/u, 'NotoSansTamil'], [/\p{Script=Telugu}/u, 'NotoSansTelugu'],
  [/\p{Script=Gujarati}/u, 'NotoSansGujarati'], [/\p{Script=Kannada}/u, 'NotoSansKannada'], [/\p{Script=Malayalam}/u, 'NotoSansMalayalam'], [/\p{Script=Oriya}/u, 'NotoSansOriya'],
  [/\p{Script=Gurmukhi}/u, 'NotoSansGurmukhi'], [/\p{Script=Arabic}/u, 'NotoNaskhArabic']
];
const BASE = 'NotoSans';
const ALL = [BASE, ...SCRIPTS.map(([, f]) => f)];
const JOINS = /[\u200c\u200d]|\p{M}/u;
const bidi = bidiFactory();
const letters = new Intl.Segmenter('en', { granularity: 'grapheme' });

interface Glyph { advanceWidth: number; id: number }
interface FontKit { unitsPerEm: number; getGlyph(id: number, codePoints: number[]): Glyph; hasGlyphForCodePoint(c: number): boolean }
/** The parts of PDFKit's embedded font this file relies on. */
interface EmbeddedFont { font: FontKit; scale: number; layout: (t: string, f?: unknown, onlyWidth?: boolean) => unknown }
export interface Run { text: string; font: string; level: number }
export interface TextStyle { x?: number; y?: number; width?: number; size: number; bold?: boolean; color?: string; align?: 'left' | 'center'; gap?: number }

let engine: Promise<Hb> | undefined;
const files = new Map<string, Buffer>();
const shapers = new Map<string, HbFont>();
const file = (name: string): Buffer => { let b = files.get(name); if (!b) files.set(name, (b = readFileSync(join(DIR, `${name}.ttf`)))); return b; };

/** Removes what cannot or must not be printed: controls, direction overrides that could disguise text, and emoji. */
export const printable = (v: string): string => v.normalize('NFC').replace(/[\p{Cc}\u2028\u2029]+/gu, ' ').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]|(?![0-9#*])\p{Extended_Pictographic}|\ufe0f/gu, '').replace(/\s+/g, ' ').trim() || '-';

/**
 * A PDF in which names and addresses print in any of the platform's scripts.
 * HarfBuzz shapes the text, because PDFKit's own shaper fails on several Indian scripts.
 */
export class TextPdf {
  readonly doc: PDFKit.PDFDocument;
  private readonly rtl = { on: false };
  private readonly ready = new Map<string, EmbeddedFont>();
  private constructor(private readonly hb: Hb, options: PDFKit.PDFDocumentOptions) { this.doc = new PDFDocument({ pdfVersion: '1.7', lang: 'en', displayTitle: true, ...options }); }
  static async create(options: PDFKit.PDFDocumentOptions): Promise<TextPdf> {
    // The package exports a promise, which import syntax does not carry through every loader.
    engine ??= createRequire(__filename)('harfbuzzjs') as Promise<Hb>;
    return new TextPdf(await engine, options);
  }

  private use(name: string): EmbeddedFont {
    const known = this.ready.get(name);
    if (known) { this.doc.font(name); return known; }
    this.doc.registerFont(name, file(name)).font(name);
    const f = (this.doc as unknown as { _font: EmbeddedFont })._font;
    f.layout = (text) => this.shape(name, f, text);
    this.ready.set(name, f);
    return f;
  }
  private shaper(name: string): HbFont {
    let s = shapers.get(name);
    if (!s) shapers.set(name, (s = this.hb.createFont(this.hb.createFace(this.hb.createBlob(file(name)), 0))));
    return s;
  }
  private shape(name: string, f: EmbeddedFont, text: string) {
    const b = this.hb.createBuffer();
    try {
      b.addText(text);
      b.guessSegmentProperties();
      b.setDirection(this.rtl.on ? 'rtl' : 'ltr');
      this.hb.shape(this.shaper(name), b);
      const out = b.json();
      const starts = [...new Set(out.map((g) => g.cl))].sort((x, y) => x - y);
      const seen = new Set<number>();
      let advanceWidth = 0;
      const glyphs: Glyph[] = [];
      const positions = out.map((g) => {
        // The first glyph of a cluster carries the cluster's characters, for copying and searching.
        const end = starts[starts.indexOf(g.cl) + 1] ?? text.length;
        const chars = seen.has(g.cl) ? [] : [...text.slice(g.cl, end)].map((c) => c.codePointAt(0)!);
        seen.add(g.cl);
        const glyph = f.font.getGlyph(g.g, chars);
        glyphs.push(glyph);
        advanceWidth += g.ax * f.scale;
        return { xAdvance: g.ax * f.scale, yAdvance: g.ay * f.scale, xOffset: g.dx * f.scale, yOffset: g.dy * f.scale, advanceWidth: glyph.advanceWidth * f.scale };
      });
      return { glyphs, positions, advanceWidth };
    } finally { b.destroy(); }
  }
  private has(name: string, c: string): boolean { return this.use(`${name}-Regular`).font.hasGlyphForCodePoint(c.codePointAt(0)!); }
  /** Chooses a font for each character and groups neighbours that share one. */
  fonts(text: string): { c: string; font: string }[] {
    const out: { c: string; font: string }[] = [];
    let last = BASE;
    for (const c of text) {
      const own = SCRIPTS.find(([r]) => r.test(c))?.[1];
      let font: string | undefined;
      if (JOINS.test(c)) font = out.length && (!own || own === last || /\p{Script=Inherited}/u.test(c)) ? last : own ?? BASE;
      else if (own) font = own;
      else if (c.codePointAt(0)! < 0x80) font = BASE;
      else font = [last, ...ALL].find((f) => this.has(f, c));
      if (font && !JOINS.test(c) && !this.has(font, c)) font = ALL.find((f) => this.has(f, c));
      out.push(font ? { c, font } : { c: '?', font: BASE });
      if (font && font !== BASE) last = font; else if (c !== ' ') last = font ?? BASE;
    }
    return out;
  }
  /** Runs in the order they appear on the page, left to right. */
  runs(line: string): Run[] {
    const chars = this.fonts(line);
    const text = chars.map((x) => x.c).join('');
    const { levels } = bidi.getEmbeddingLevels(text, 'auto');
    const runs: Run[] = [];
    let at = 0;
    for (const { c, font } of chars) {
      const level = levels[at];
      const prev = runs[runs.length - 1];
      if (prev && prev.font === font && prev.level === level) prev.text += c; else runs.push({ text: c, font, level });
      at += c.length;
    }
    const max = Math.max(0, ...runs.map((r) => r.level));
    for (let l = max; l > 0; l--) {
      for (let i = 0; i < runs.length; i++) {
        if (runs[i].level < l) continue;
        let j = i;
        while (j + 1 < runs.length && runs[j + 1].level >= l) j++;
        runs.splice(i, j - i + 1, ...runs.slice(i, j + 1).reverse());
        i = j;
      }
    }
    return runs;
  }
  private widthOf(runs: Run[], size: number, bold: boolean): number {
    return runs.reduce((w, r) => { this.use(`${r.font}-${bold ? 'Bold' : 'Regular'}`); this.rtl.on = r.level % 2 === 1; return w + this.doc.fontSize(size).widthOfString(r.text); }, 0);
  }
  /** Breaks text into lines that fit, splitting a single over-long word only between whole letters. */
  lines(value: string, width: number, size: number, bold = false): string[] {
    const fits = (s: string) => this.widthOf(this.runs(s), size, bold) <= width;
    const out: string[] = [];
    let line = '';
    for (const word of printable(value).split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) { line = next; continue; }
      if (line) out.push(line);
      line = word;
      if (fits(word)) continue;
      line = '';
      for (const { segment } of letters.segment(word)) { if (line && !fits(line + segment)) { out.push(line); line = segment; } else line += segment; }
    }
    if (line) out.push(line);
    return out;
  }
  /** Draws text and moves `doc.y` below it. */
  text(value: string, s: TextStyle): this {
    const { doc } = this;
    const x = s.x ?? doc.page.margins.left;
    const width = s.width ?? doc.page.width - x - doc.page.margins.right;
    const bold = s.bold ?? false;
    const height = s.size * 1.5;
    let y = s.y ?? doc.y;
    for (const line of this.lines(value, width, s.size, bold)) {
      if (y + height > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = doc.page.margins.top; }
      const runs = this.runs(line);
      let at = x + (s.align === 'center' ? (width - this.widthOf(runs, s.size, bold)) / 2 : 0);
      // Screen readers and copying get the real text, whatever shapes were drawn.
      doc.markContent('Span', { actual: line });
      for (const r of runs) {
        this.use(`${r.font}-${bold ? 'Bold' : 'Regular'}`);
        this.rtl.on = r.level % 2 === 1;
        doc.fontSize(s.size).fillColor(s.color ?? 'black');
        const w = doc.widthOfString(r.text);
        doc.text(r.text, at, y + s.size * 1.1, { lineBreak: false, baseline: 'alphabetic' });
        at += w;
      }
      doc.endMarkedContent();
      y += height;
    }
    doc.x = x;
    doc.y = y + (s.gap ?? 0);
    return this;
  }
  /** Finishes the file. */
  buffer(): Promise<Buffer> {
    const chunks: Buffer[] = [];
    this.doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((ok, fail) => { this.doc.on('end', () => ok(Buffer.concat(chunks))); this.doc.on('error', fail); });
    this.doc.end();
    return done;
  }
}
