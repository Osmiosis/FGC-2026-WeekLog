// frontend/src/lib/demo/media.ts
// Uploaded blobs live only in memory for the session (localStorage can't hold
// binaries). Metadata persists in the store; if a blob isn't present (e.g. after
// a refresh, or for seed media), apiBlobUrl falls back to a bundled placeholder.

const blobs = new Map<string, string>(); // mediaId -> object URL

// A neutral inline SVG placeholder (data URL, always available).
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='200'>` +
      `<rect width='100%' height='100%' fill='#2a2320'/>` +
      `<text x='50%' y='50%' fill='#b98a72' font-family='monospace' font-size='13' ` +
      `text-anchor='middle' dominant-baseline='middle'>demo media</text></svg>`
  );

export function putBlob(mediaId: string, file: File): void {
  blobs.set(mediaId, URL.createObjectURL(file));
}

export function urlFor(mediaId: string): string {
  return blobs.get(mediaId) ?? PLACEHOLDER;
}
