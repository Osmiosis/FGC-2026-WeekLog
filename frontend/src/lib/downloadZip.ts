import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { api, apiBytes } from "./api";

// Client-side ZIP export. The Worker can't build the whole archive: reading and
// CRC-ing the entire media set (~404 MB and growing) exceeds the Worker CPU
// limit and Cloudflare kills the request with a 503. Instead the Worker serves a
// cheap manifest (file list + inline text summaries), and the browser fetches
// each media file one at a time and streams it into a ZIP saved to disk.

interface ManifestEntry {
  path: string;
  mediaId?: string; // fetch bytes from /api/media/:id/file
  text?: string; // inline content (summaries)
}
interface Manifest {
  entries: ManifestEntry[];
}

export type ZipProgress = (done: number, total: number) => void;

// File System Access API isn't in the DOM typings across our TS lib, so keep the
// surface we touch narrow and locally typed.
interface SavePickerWindow {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<FileSink> }>;
}
interface FileSink {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort?: (reason?: unknown) => Promise<void>;
}

// Returns false if the user cancelled the save dialog; true once the ZIP is
// written. Throws on real failures so callers can surface them.
export async function downloadAllMediaZip(onProgress?: ZipProgress): Promise<boolean> {
  // Open the save dialog FIRST, while the click's user activation is still live
  // (any await before showSaveFilePicker can invalidate the gesture). Fall back
  // to an in-memory Blob where the API is unavailable (Firefox/Safari).
  const picker = (window as unknown as SavePickerWindow).showSaveFilePicker;
  let sink: FileSink | null = null;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: "all-media.zip",
        types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
      });
      sink = await handle.createWritable();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false; // user cancelled
      throw e;
    }
  }

  const { entries } = await api<Manifest>("/api/export/manifest");

  const zip = new Zip();
  const pending: Uint8Array[] = [];
  let zipErr: unknown = null;
  zip.ondata = (err, chunk) => {
    if (err) zipErr = err;
    else if (chunk.length) pending.push(chunk);
  };
  const memChunks: Uint8Array[] = [];
  const flush = async () => {
    if (zipErr) throw zipErr;
    while (pending.length) {
      const chunk = pending.shift()!;
      if (sink) await sink.write(chunk);
      else memChunks.push(chunk);
    }
  };

  try {
    let done = 0;
    for (const e of entries) {
      const file = new ZipPassThrough(e.path);
      zip.add(file);
      if (e.text != null) {
        file.push(strToU8(e.text), true);
      } else if (e.mediaId) {
        try {
          file.push(await apiBytes(`/api/media/${e.mediaId}/file`), true);
        } catch {
          file.push(new Uint8Array(0), true); // one unreadable file shouldn't sink the export
        }
      } else {
        file.push(new Uint8Array(0), true);
      }
      await flush();
      onProgress?.(++done, entries.length);
    }
    zip.end();
    await flush();

    if (sink) await sink.close();
    else saveBlob(new Blob(memChunks as BlobPart[], { type: "application/zip" }), "all-media.zip");
    return true;
  } catch (err) {
    if (sink?.abort) await sink.abort(err).catch(() => {});
    throw err;
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
