// Owns /api/notebook: reads the published report snapshots + pending requests,
// and exposes the admin generate + member refresh-request actions.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { NotebookReportsMap, PendingRequestSummary, ReportKind, TimelinePayload } from "@weeklog/types";

export function useNotebook() {
  const [reports, setReports] = useState<NotebookReportsMap>({});
  const [pending, setPending] = useState<PendingRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setError(null);
    api<NotebookReportsMap>("/api/notebook/reports").then(setReports).catch((e) => setError(String(e)));
    api<PendingRequestSummary[]>("/api/notebook/requests").then(setPending).catch(() => setPending([]));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const generateTimeline = async () => {
    setBusy(true);
    try {
      await api("/api/notebook/generate/timeline", { method: "POST" });
      reload();
    } finally {
      setBusy(false);
    }
  };

  const requestRefresh = async (kind: ReportKind) => {
    await api("/api/notebook/requests", { method: "POST", body: JSON.stringify({ kind }) });
    reload();
  };

  const timeline = (reports.timeline?.payload ?? null) as TimelinePayload | null;
  return { reports, timeline, pending, error, busy, reload, generateTimeline, requestRefresh };
}
