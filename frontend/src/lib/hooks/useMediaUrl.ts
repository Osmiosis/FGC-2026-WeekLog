// PROTECTED WIRING — do not edit during design work. Resolves an authed media URL.
import { useEffect, useState } from "react";
import { apiBlobUrl } from "../api";

// Fetch a media file (with auth) and expose an object URL for <img>/links.
export function useMediaUrl(mediaId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    apiBlobUrl(`/api/media/${mediaId}/file`)
      .then((u) => {
        made = u;
        if (live) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [mediaId]);
  return url;
}
