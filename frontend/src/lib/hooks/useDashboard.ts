// PROTECTED WIRING — do not edit during design work. Owns /api/dashboard + exports.
import { useCallback, useEffect, useState } from "react";
import { api, downloadAuthed } from "../api";
import type { Dashboard } from "./types";

export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [driveConfigured, setDriveConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    api<Dashboard>("/api/dashboard").then(setData).catch((e) => setError(String(e)));
    api<{ configured: boolean }>("/api/drive/status")
      .then((s) => setDriveConfigured(s.configured))
      .catch(() => setDriveConfigured(false));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  // Surface failures: the fetch throws on any non-OK response, and an
  // unhandled promise here would make the button look like it does nothing.
  const downloadAllMedia = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadAuthed("/api/export/all-media/zip", "all-media.zip");
    } catch (e) {
      setDownloadError(`Export failed (${String(e)}). Try again in a moment.`);
    } finally {
      setDownloading(false);
    }
  };

  return { data, driveConfigured, error, reload, downloadAllMedia, downloading, downloadError };
}
