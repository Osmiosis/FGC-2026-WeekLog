// PROTECTED WIRING — do not edit during design work. Owns search + build needs.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Submission } from "./types";

export const SUBSYSTEMS = [
  "Drivetrain/Collector",
  "Shooter",
  "Climber",
  "Practice Arena",
  "Programming",
  "Strategy",
];
export const SUBMISSION_KINDS = [
  "accomplishment",
  "build_need",
  "performance_goal",
  "failure",
  "note",
];

export function useBuildNeeds(showResolved: boolean) {
  const [rows, setRows] = useState<Submission[]>([]);

  const reload = useCallback(() => {
    const path = showResolved ? "/api/build-needs" : "/api/build-needs?open=1";
    return api<Submission[]>(path).then(setRows).catch(() => {});
  }, [showResolved]);
  useEffect(() => {
    reload();
  }, [reload]);

  const setResolved = async (id: string, resolved: boolean) => {
    await api(`/api/submissions/${id}/${resolved ? "resolve" : "unresolve"}`, { method: "POST" });
    reload();
  };

  return { rows, reload, setResolved };
}

export interface SearchFilters {
  q?: string;
  subsystem?: string;
  kind?: string;
  from?: string;
  to?: string;
  status?: string;
}

export function useSearch() {
  const [results, setResults] = useState<Submission[]>([]);
  const [ran, setRan] = useState(false);

  const run = async (filters: SearchFilters) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const res = await api<Submission[]>(`/api/search?${params.toString()}`);
    setResults(res);
    setRan(true);
  };

  return { results, ran, run };
}
