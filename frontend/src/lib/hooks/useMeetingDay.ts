// PROTECTED WIRING — do not edit during design work. Owns a meeting day's content.
import { useCallback, useEffect, useState } from "react";
import { api, apiForm, downloadAuthed } from "../api";
import type { MeetingDayDetail, AttendanceRow, Submission, MediaRow, AvailableRequirement } from "./types";

export function useMeetingDay(dayId: string) {
  const [detail, setDetail] = useState<MeetingDayDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [d, a, s, m] = await Promise.all([
        api<MeetingDayDetail>(`/api/meeting-days/${dayId}`),
        api<AttendanceRow[]>(`/api/meeting-days/${dayId}/attendance`),
        api<Submission[]>(`/api/meeting-days/${dayId}/submissions`),
        api<MediaRow[]>(`/api/meeting-days/${dayId}/media`),
      ]);
      setDetail(d);
      setAttendance(a);
      setSubmissions(s);
      setMedia(m);
    } catch (e) {
      setError(String(e));
    }
  }, [dayId]);
  useEffect(() => {
    reload();
  }, [reload]);

  const setPresent = async (memberId: string, present: number) => {
    await api(`/api/meeting-days/${dayId}/attendance`, {
      method: "POST",
      body: JSON.stringify({ member_id: memberId, present }),
    });
    reload();
  };

  const addSubmission = async (input: {
    kind: string;
    content: string;
    requirementId?: string;
    subsystem?: string;
  }) => {
    await api(`/api/meeting-days/${dayId}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        kind: input.kind,
        content: input.content,
        requirement_id: input.requirementId,
        subsystem: input.subsystem || undefined,
      }),
    });
    reload();
  };

  const uploadMedia = async (input: {
    file: File;
    kind?: string;
    caption?: string;
    subsystem?: string;
    requirementId?: string;
  }) => {
    const form = new FormData();
    form.set("file", input.file);
    if (input.kind) form.set("kind", input.kind);
    if (input.caption) form.set("caption", input.caption);
    if (input.subsystem) form.set("subsystem", input.subsystem);
    if (input.requirementId) form.set("requirement_id", input.requirementId);
    await apiForm(`/api/meeting-days/${dayId}/media`, form);
    reload();
  };

  const toggleCompulsory = async (reqId: string, compulsory: number) => {
    await api(`/api/meeting-days/${dayId}/requirements/${reqId}`, {
      method: "PATCH",
      body: JSON.stringify({ compulsory }),
    });
    reload();
  };

  const removeRequirement = async (reqId: string) => {
    await api(`/api/meeting-days/${dayId}/requirements/${reqId}`, { method: "DELETE" });
    reload();
  };

  const addRequirement = async (
    input:
      | { templateId: string }
      | { label: string; compulsory: number; expectedKind: string }
  ) => {
    await api(`/api/meeting-days/${dayId}/requirements`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    reload();
  };

  const loadAvailable = useCallback(
    (): Promise<AvailableRequirement[]> =>
      api<AvailableRequirement[]>(`/api/meeting-days/${dayId}/requirements/available`),
    [dayId]
  );

  const rename = async (title: string) => {
    await api(`/api/meeting-days/${dayId}`, { method: "PATCH", body: JSON.stringify({ title }) });
    reload();
  };

  const unmark = async () => {
    await api(`/api/meeting-days/${dayId}`, { method: "DELETE" });
  };

  const downloadZip = () =>
    downloadAuthed(`/api/meeting-days/${dayId}/zip`, `meeting-${detail?.date ?? dayId}.zip`);

  return {
    detail,
    attendance,
    submissions,
    media,
    error,
    reload,
    setPresent,
    addSubmission,
    uploadMedia,
    toggleCompulsory,
    removeRequirement,
    addRequirement,
    loadAvailable,
    rename,
    unmark,
    downloadZip,
  };
}
