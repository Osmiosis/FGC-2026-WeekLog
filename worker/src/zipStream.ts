import { Zip, ZipPassThrough } from "fflate";
import type { Env } from "./bindings";

// A file to place in the archive: either inline bytes (text summaries) or an R2
// key whose bytes are fetched lazily while streaming. Paths must already be
// unique — callers de-duplicate with uniquePath before handing entries here.
export type ZipEntry =
  | { path: string; bytes: Uint8Array }
  | { path: string; r2Key: string };

// Stream a ZIP built from `entries`, pulling each R2 object one at a time and
// draining framed chunks to the response with backpressure. Peak memory stays
// about one file. Buffering the whole archive (zipSync) OOMs the 128 MB Worker
// isolate — Cloudflare then kills the request with an HTML 503 that never
// reaches our onError handler.
export function streamZip(env: Env, entries: ZipEntry[], filename: string): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const queue: Uint8Array[] = [];
  let zipError: unknown = null;
  const zip = new Zip((err, chunk) => {
    if (err) zipError = err;
    else if (chunk.length) queue.push(chunk);
  });

  const drain = async () => {
    if (zipError) throw zipError;
    while (queue.length) await writer.write(queue.shift()!);
  };

  // Produce concurrently with the response streaming out. Keeping the body open
  // holds the request alive until we close the writer.
  (async () => {
    try {
      for (const e of entries) {
        let bytes: Uint8Array;
        if ("bytes" in e) {
          bytes = e.bytes;
        } else {
          const obj = await env.MEDIA.get(e.r2Key);
          if (!obj) continue; // media row without bytes in R2 — skip
          bytes = new Uint8Array(await obj.arrayBuffer());
        }
        const file = new ZipPassThrough(e.path);
        zip.add(file);
        file.push(bytes, true);
        await drain();
      }
      zip.end();
      await drain();
      await writer.close();
    } catch (err) {
      await writer.abort(err).catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
