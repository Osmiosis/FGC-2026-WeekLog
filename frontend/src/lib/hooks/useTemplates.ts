// PROTECTED WIRING — do not edit during design work. Owns /api/requirement-templates.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Template } from "./types";

export const EXPECTED_KINDS = ["attendance", "text", "media", "any"];

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return api<Template[]>("/api/requirement-templates")
      .then(setTemplates)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const add = async (label: string, expected_kind: string, compulsory: boolean) => {
    await api("/api/requirement-templates", {
      method: "POST",
      body: JSON.stringify({ label, expected_kind, compulsory: compulsory ? 1 : 0 }),
    });
    reload();
  };
  const patch = async (id: string, body: Partial<Template>) => {
    await api(`/api/requirement-templates/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  };
  // Optimistic local reorder, then persist the new order.
  const reorder = async (ordered: Template[]) => {
    setTemplates(ordered);
    await api("/api/requirement-templates/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: ordered.map((t) => t.id) }),
    });
    reload();
  };

  return { templates, error, reload, add, patch, reorder };
}
