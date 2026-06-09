// PROTECTED WIRING — do not edit during design work. Owns /api/members + /api/committees.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Member, Committee } from "./types";

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return Promise.all([
      api<Member[]>("/api/members").then(setMembers),
      api<Committee[]>("/api/committees").then(setCommittees),
    ]).catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const addMember = async (name: string, committeeIds: string[]) => {
    await api("/api/members", { method: "POST", body: JSON.stringify({ name, committeeIds }) });
    reload();
  };
  const updateMember = async (
    id: string,
    patch: { name?: string; committeeIds?: string[]; active?: number }
  ) => {
    await api(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    reload();
  };
  const setActive = async (id: string, active: number) => {
    await updateMember(id, { active });
  };

  return { members, committees, error, reload, addMember, updateMember, setActive };
}
