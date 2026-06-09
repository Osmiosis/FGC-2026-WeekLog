// PROTECTED WIRING — do not edit during design work. Owns /api/deadlines.
import { useCallback, useEffect, useState } from "react";
import { api, apiForm } from "../api";
import type { Deadline, MediaRow } from "./types";

export const DEADLINE_CATEGORIES = ["social_media", "design", "strategy", "other"];

export function useDeadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return api<Deadline[]>("/api/deadlines").then(setDeadlines).catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const create = async (input: {
    title: string;
    due_date: string;
    category?: string;
    link?: string;
  }) => {
    await api("/api/deadlines", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        due_date: input.due_date,
        category: input.category,
        link: input.link || undefined,
      }),
    });
    reload();
  };
  const markDone = async (id: string) => {
    await api(`/api/deadlines/${id}/done`, { method: "POST" });
    reload();
  };
  const reopen = async (id: string) => {
    await api(`/api/deadlines/${id}/reopen`, { method: "POST" });
    reload();
  };
  const remove = async (id: string) => {
    await api(`/api/deadlines/${id}`, { method: "DELETE" });
    reload();
  };

  return { deadlines, error, reload, create, markDone, reopen, remove };
}

// Proof media attached to a single deadline.
export function useDeadlineProof(deadlineId: string) {
  const [rows, setRows] = useState<MediaRow[]>([]);

  const reload = useCallback(() => {
    return api<MediaRow[]>(`/api/deadlines/${deadlineId}/media`).then(setRows).catch(() => {});
  }, [deadlineId]);
  useEffect(() => {
    reload();
  }, [reload]);

  const upload = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "doc");
    await apiForm(`/api/deadlines/${deadlineId}/media`, form);
    reload();
  };

  return { rows, reload, upload };
}
