declare module 'bidi-js' {
  interface Bidi { getEmbeddingLevels(t: string, d?: 'ltr' | 'rtl' | 'auto'): { levels: Uint8Array } }
  function factory(): Bidi;
  export = factory;
}
