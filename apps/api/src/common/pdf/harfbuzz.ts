/** The parts of harfbuzzjs 0.10 that are used. */
export interface HbGlyph { g: number; cl: number; ax: number; ay: number; dx: number; dy: number }
export interface HbBuffer { addText(t: string): void; guessSegmentProperties(): void; setDirection(d: 'ltr' | 'rtl'): void; json(): HbGlyph[]; destroy(): void }
export interface HbFont { destroy(): void }
export interface Hb { createBlob(b: Uint8Array): unknown; createFace(blob: unknown, i: number): unknown; createFont(face: unknown): HbFont; createBuffer(): HbBuffer; shape(f: HbFont, b: HbBuffer): void }
