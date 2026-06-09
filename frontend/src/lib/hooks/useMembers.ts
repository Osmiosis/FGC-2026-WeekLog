// PROTECTED WIRING — do not edit during design work. Owns /api/members.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Member } from "./types";

export const COMMITTEES = [
  "Outreach",
  "Design",
  "Notebook",
  "Strategy",
  "Drivetrain/Collector",
  "Shooter",
  "Climber",
  "Practice Arena",
  "Programming",
];

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return api<Member[]>("/api/members").then(setMembers).catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const addMember = async (name: string, committee: string) => {
    await api("/api/members", { method: "POST", body: JSON.stringify({ name, committee }) });
    reload();
  };
  const rename = async (id: string, name: string) => {
    await api(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    reload();
  };
  const setActive = async (id: string, active: number) => {
    await api(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
    reload();
  };

  return { members, error, reload, addMember, rename, setActive };
}
