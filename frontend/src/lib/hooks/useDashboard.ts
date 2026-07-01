// PROTECTED WIRING — do not edit during design work. Owns /api/dashboard + exports.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { downloadAllMediaZip } from "../downloadZip";
import type { Dashboard } from "./types";

export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [driveConfigured, setDriveConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

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

  // The ZIP is built in the browser (see downloadZip): the Worker can't zip the
  // whole media set within its CPU limit. Surface failures and progress so the
  // button never looks dead during a large, slow export.
  const downloadAllMedia = async () => {
    setDownloadError(null);
    setDownloadProgress(null);
    setDownloading(true);
    try {
      await downloadAllMediaZip((done, total) => setDownloadProgress({ done, total }));
    } catch (e) {
      setDownloadError(`Export failed (${String(e)}). Try again in a moment.`);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  return { data, driveConfigured, error, reload, downloadAllMedia, downloading, downloadError, downloadProgress };
}
