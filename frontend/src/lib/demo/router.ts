// frontend/src/lib/demo/router.ts
// In-browser replacement for the Worker's HTTP API. route() matches method+path
// against handlers that read/write the localStorage DemoDB and return plain JSON,
// mirroring worker/src/routes/* behavior. Everyone is admin in the demo.
import { load, save } from "./store";
import { putBlob } from "./media";
import {
  deriveDay, dayStatusFromDerived, deadlineRag, daysBetweenUTC, addDaysUTC,
  committeesOf, todayUTC, type Rag,
} from "./compute";
import type { DemoDB } from "./types";

const uuid = () => crypto.randomUUID();
const DEMO_EMAIL = "demo@demo.app";

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(`${status}: ${msg}`); }
}

// Parse "/api/x?y=z" into a pathname + query map.
function parse(path: string): { pathname: string; query: URLSearchParams } {
  const u = new URL(path, "http://demo.local");
  return { pathname: u.pathname, query: u.searchParams };
}

export function route(method: string, path: string, body?: unknown, form?: FormData): unknown {
  const db = load();
  const { pathname, query } = parse(path);
  const seg = pathname.replace(/^\/api\//, "").split("/"); // e.g. ["meeting-days", "<id>", "attendance"]
  const m = method.toUpperCase();
  const b = (body ?? {}) as Record<string, unknown>;

  const result = dispatch(db, m, seg, query, b, form);
  save(db); // persist any mutation the handler made
  return result;
}

function dispatch(db: DemoDB, m: string, seg: string[], q: URLSearchParams, b: Record<string, unknown>, form?: FormData): unknown {
  const today = todayUTC();
  const head = seg[0];

  // ---- identity / integrations ----
  if (head === "me" && m === "GET") return { email: DEMO_EMAIL, isAdmin: true };
  if (head === "drive" && seg[1] === "status" && m === "GET") return { configured: false };

  // ---- committees ----
  if (head === "committees" && m === "GET") {
    return [...db.committees].sort((a, c) => a.sort_order - c.sort_order || a.name.localeCompare(c.name))
      .map((c) => ({ id: c.id, name: c.name }));
  }

  // ---- members ----
  if (head === "members") {
    if (m === "GET") {
      const activeOnly = q.get("active") === "1";
      return db.members
        .filter((mem) => !activeOnly || mem.active === 1)
        .sort((a, c) => a.name.localeCompare(c.name))
        .map((mem) => ({ id: mem.id, name: mem.name, active: mem.active, committees: committeesOf(db, mem.id) }));
    }
    if (m === "POST") {
      const name = String(b.name ?? "").trim();
      if (!name) throw new HttpError(400, "name required");
      const id = uuid();
      db.members.push({ id, name, active: 1 });
      setCommittees(db, id, (b.committeeIds as string[]) ?? []);
      return loadMember(db, id);
    }
    if (m === "PATCH" && seg[1]) {
      const mem = db.members.find((x) => x.id === seg[1]);
      if (!mem) throw new HttpError(404, "not found");
      if (typeof b.name === "string") mem.name = b.name;
      if (typeof b.active === "number") mem.active = b.active;
      if (Array.isArray(b.committeeIds)) setCommittees(db, mem.id, b.committeeIds as string[]);
      return loadMember(db, mem.id);
    }
  }

  // ---- requirement templates ----
  if (head === "requirement-templates") {
    if (seg[1] === "reorder" && m === "POST") {
      const ids = (b.ids as string[]) ?? [];
      ids.forEach((id, i) => { const t = db.templates.find((x) => x.id === id); if (t) t.sort_order = i + 1; });
      return { ok: true };
    }
    if (m === "GET") {
      const activeOnly = q.get("active") === "1";
      return db.templates.filter((t) => !activeOnly || t.active === 1).sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0));
    }
    if (m === "POST") {
      const label = String(b.label ?? "").trim();
      if (!label) throw new HttpError(400, "label required");
      const sort = Math.max(0, ...db.templates.map((t) => t.sort_order ?? 0)) + 1;
      const row = { id: uuid(), label, description: (b.description as string) ?? null, compulsory: (b.compulsory as number) ?? 1, expected_kind: (b.expected_kind as string) ?? null, active: 1, sort_order: sort };
      db.templates.push(row);
      return row;
    }
    if (m === "PATCH" && seg[1]) {
      const t = db.templates.find((x) => x.id === seg[1]);
      if (!t) throw new HttpError(404, "not found");
      if (b.label !== undefined) t.label = b.label as string;
      if (b.description !== undefined) t.description = b.description as string | null;
      if (b.compulsory !== undefined) t.compulsory = b.compulsory as number;
      if (b.expected_kind !== undefined) t.expected_kind = b.expected_kind as string | null;
      if (b.active !== undefined) t.active = b.active as number;
      if (b.sort_order !== undefined) t.sort_order = b.sort_order as number;
      return t;
    }
  }

  // ---- deadlines ----
  if (head === "deadlines") {
    if (!seg[1] && m === "GET") {
      return [...db.deadlines].sort((a, c) => a.due_date.localeCompare(c.due_date))
        .map((d) => ({ ...d, status_rag: deadlineRag({ status: d.status, due_date: d.due_date, today }) }));
    }
    if (!seg[1] && m === "POST") {
      if (!b.title || !b.due_date) throw new HttpError(400, "title and due_date required");
      const row = { id: uuid(), title: b.title as string, description: (b.description as string) ?? null, category: (b.category as string) ?? null, due_date: b.due_date as string, status: "open", completed_at: null, link: (b.link as string) ?? null };
      db.deadlines.push(row);
      return row;
    }
    if (seg[1] && seg[2] === "done" && m === "POST") {
      const d = db.deadlines.find((x) => x.id === seg[1]);
      if (!d) throw new HttpError(404, "not found");
      d.status = "done"; d.completed_at = new Date().toISOString();
      return d;
    }
    if (seg[1] && seg[2] === "reopen" && m === "POST") {
      const d = db.deadlines.find((x) => x.id === seg[1]);
      if (d) { d.status = "open"; d.completed_at = null; }
      return d ?? { ok: true };
    }
    if (seg[1] && seg[2] === "media" && m === "GET") {
      return db.media.filter((x) => x.deadline_id === seg[1]).sort((a, c) => (c.uploaded_at).localeCompare(a.uploaded_at));
    }
    if (seg[1] && seg[2] === "media" && m === "POST") {
      return addMedia(db, form, { deadline_id: seg[1] });
    }
    if (seg[1] && !seg[2] && m === "DELETE") {
      db.deadlines = db.deadlines.filter((x) => x.id !== seg[1]);
      return { ok: true };
    }
  }

  // ---- search + build needs ----
  if (head === "search" && m === "GET") return runSearch(db, q, today);
  if (head === "build-needs" && m === "GET") {
    const openOnly = q.get("open") === "1";
    return db.submissions
      .filter((s) => s.kind === "build_need" && (!openOnly || s.resolved === 0))
      .map((s) => ({ ...s, date: dateOf(db, s.meeting_day_id) }))
      .sort((a, c) => (c.date ?? "").localeCompare(a.date ?? ""));
  }

  // ---- submissions resolve/unresolve ----
  if (head === "submissions" && seg[1] && (seg[2] === "resolve" || seg[2] === "unresolve") && m === "POST") {
    const s = db.submissions.find((x) => x.id === seg[1]);
    const resolved = seg[2] === "resolve" ? 1 : 0;
    if (s) s.resolved = resolved;
    return { ok: true, resolved };
  }

  // ---- dashboard ----
  if (head === "dashboard" && m === "GET") return buildDashboard(db, today);

  // ---- meeting days ----
  if (head === "meeting-days") return meetingDays(db, m, seg, q, b, form, today);

  throw new HttpError(404, `no route for ${m} /api/${seg.join("/")}`);
}

// ---------- meeting-days sub-router ----------
function meetingDays(db: DemoDB, m: string, seg: string[], q: URLSearchParams, b: Record<string, unknown>, form: FormData | undefined, today: string): unknown {
  if (!seg[1]) {
    if (m === "GET") {
      const from = q.get("from"); const to = q.get("to");
      return db.meeting_days
        .filter((d) => !from || !to || (d.date >= from && d.date <= to))
        .sort((a, c) => a.date.localeCompare(c.date))
        .map((d) => ({ ...d, status: dayStatusFromDerived(d.date, today, deriveDay(db, d.id)) }));
    }
    if (m === "POST") {
      const date = String(b.date ?? "");
      if (!date) throw new HttpError(400, "date required");
      if (db.meeting_days.some((d) => d.date === date)) throw new HttpError(409, "already a meeting day");
      const id = uuid();
      db.meeting_days.push({ id, date, title: (b.title as string) ?? null });
      const count = snapshot(db, id);
      return { id, date, title: (b.title as string) ?? null, requirementCount: count };
    }
  }

  const id = seg[1];
  const day = db.meeting_days.find((d) => d.id === id);

  if (seg.length === 2) {
    if (m === "GET") {
      if (!day) throw new HttpError(404, "not found");
      const derived = deriveDay(db, id);
      return { ...day, status: dayStatusFromDerived(day.date, today, derived), requirements: derived.requirements, missingCompulsory: derived.missingCompulsory };
    }
    if (m === "PATCH") {
      if (!day) throw new HttpError(404, "not found");
      const raw = b.title;
      day.title = raw == null ? null : String(raw).trim().slice(0, 120) || null;
      return { ok: true, ...day };
    }
    if (m === "DELETE") {
      db.media = db.media.filter((x) => x.meeting_day_id !== id);
      db.submissions = db.submissions.filter((x) => x.meeting_day_id !== id);
      db.attendance = db.attendance.filter((x) => x.meeting_day_id !== id);
      db.meeting_requirements = db.meeting_requirements.filter((x) => x.meeting_day_id !== id);
      db.meeting_days = db.meeting_days.filter((x) => x.id !== id);
      return { ok: true };
    }
  }

  const sub = seg[2];
  if (sub === "attendance") {
    if (m === "GET") {
      return db.members.filter((mem) => mem.active === 1).sort((a, c) => a.name.localeCompare(c.name)).map((mem) => {
        const att = db.attendance.find((a) => a.meeting_day_id === id && a.member_id === mem.id);
        return { member_id: mem.id, name: mem.name, present: att?.present ?? 0, committees: committeesOf(db, mem.id) };
      });
    }
    if (m === "POST") {
      const memberId = b.member_id as string;
      if (!memberId) throw new HttpError(400, "member_id required");
      const present = b.present ? 1 : 0;
      const existing = db.attendance.find((a) => a.meeting_day_id === id && a.member_id === memberId);
      if (existing) existing.present = present;
      else db.attendance.push({ id: uuid(), meeting_day_id: id, member_id: memberId, present });
      return { ok: true, member_id: memberId, present };
    }
  }

  if (sub === "submissions") {
    if (m === "GET") {
      return db.submissions.filter((s) => s.meeting_day_id === id).sort((a, c) => c.created_at.localeCompare(a.created_at));
    }
    if (m === "POST") {
      const kind = b.kind as string;
      if (!kind) throw new HttpError(400, "kind required");
      const row = { id: uuid(), meeting_day_id: id, requirement_id: (b.requirement_id as string) ?? null, kind, subsystem: (b.subsystem as string) ?? null, content: (b.content as string) ?? null, created_by: DEMO_EMAIL, created_at: new Date().toISOString(), resolved: 0 };
      db.submissions.push(row);
      return row;
    }
  }

  if (sub === "media") {
    if (m === "GET") {
      return db.media.filter((x) => x.meeting_day_id === id).sort((a, c) => c.uploaded_at.localeCompare(a.uploaded_at));
    }
    if (m === "POST") {
      return addMedia(db, form, { meeting_day_id: id, requirement_id: formStr(form, "requirement_id"), subsystem: formStr(form, "subsystem") });
    }
  }

  if (sub === "requirements") {
    if (seg[3] === "available" && m === "GET") {
      const onDay = new Set(db.meeting_requirements.filter((r) => r.meeting_day_id === id && r.active === 1 && r.template_id).map((r) => r.template_id));
      return db.templates.filter((t) => t.active === 1 && !onDay.has(t.id)).sort((a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0))
        .map((t) => ({ id: t.id, label: t.label, compulsory: t.compulsory, expected_kind: t.expected_kind }));
    }
    if (seg[3]) {
      const req = db.meeting_requirements.find((r) => r.id === seg[3] && r.meeting_day_id === id && r.active === 1);
      if (m === "PATCH") {
        if (b.compulsory !== 0 && b.compulsory !== 1) throw new HttpError(400, "compulsory must be 0 or 1");
        if (!req) throw new HttpError(404, "not found");
        req.compulsory = b.compulsory as number;
        return { ok: true, requirements: deriveDay(db, id).requirements };
      }
      if (m === "DELETE") {
        if (!req) throw new HttpError(404, "not found");
        req.active = 0;
        return { ok: true, requirements: deriveDay(db, id).requirements };
      }
    }
    if (!seg[3] && m === "POST") {
      if (!day) throw new HttpError(404, "not found");
      if (b.templateId) {
        const tplId = b.templateId as string;
        const existing = db.meeting_requirements.find((r) => r.meeting_day_id === id && r.template_id === tplId);
        if (existing) existing.active = 1;
        else {
          const t = db.templates.find((x) => x.id === tplId && x.active === 1);
          if (!t) throw new HttpError(404, "template not found");
          db.meeting_requirements.push({ id: uuid(), meeting_day_id: id, template_id: tplId, label: t.label, compulsory: t.compulsory, expected_kind: t.expected_kind, status: "missing", active: 1, custom: 0 });
        }
      } else if (b.label) {
        const kind = (b.expectedKind as string) ?? "any";
        if (!["attendance", "text", "media", "any"].includes(kind)) throw new HttpError(400, "invalid expectedKind");
        db.meeting_requirements.push({ id: uuid(), meeting_day_id: id, template_id: null, label: b.label as string, compulsory: b.compulsory ? 1 : 0, expected_kind: kind, status: "missing", active: 1, custom: 1 });
      } else {
        throw new HttpError(400, "templateId or label required");
      }
      return { ok: true, requirements: deriveDay(db, id).requirements };
    }
  }

  throw new HttpError(404, `no meeting-days route for ${m} ${seg.join("/")}`);
}

// ---------- helpers ----------
function snapshot(db: DemoDB, dayId: string): number {
  const active = db.templates.filter((t) => t.active === 1).sort((a, c) => a.sort_order - c.sort_order);
  for (const t of active) {
    db.meeting_requirements.push({ id: uuid(), meeting_day_id: dayId, template_id: t.id, label: t.label, compulsory: t.compulsory, expected_kind: t.expected_kind, status: "missing", active: 1, custom: 0 });
  }
  return active.length;
}

function setCommittees(db: DemoDB, memberId: string, committeeIds: string[]) {
  db.member_committees = db.member_committees.filter((mc) => mc.member_id !== memberId);
  for (const cid of committeeIds) {
    if (!db.member_committees.some((mc) => mc.member_id === memberId && mc.committee_id === cid)) {
      db.member_committees.push({ member_id: memberId, committee_id: cid });
    }
  }
}

function loadMember(db: DemoDB, id: string) {
  const mem = db.members.find((x) => x.id === id)!;
  return { id: mem.id, name: mem.name, active: mem.active, committees: committeesOf(db, id) };
}

function dateOf(db: DemoDB, dayId: string): string | undefined {
  return db.meeting_days.find((d) => d.id === dayId)?.date;
}

function formStr(form: FormData | undefined, key: string): string | null {
  const v = form?.get(key);
  return typeof v === "string" ? v : null;
}

function addMedia(db: DemoDB, form: FormData | undefined, fields: { meeting_day_id?: string; deadline_id?: string; requirement_id?: string | null; subsystem?: string | null }) {
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file required");
  const id = uuid();
  putBlob(id, file);
  const row = {
    id, meeting_day_id: fields.meeting_day_id ?? null, deadline_id: fields.deadline_id ?? null,
    requirement_id: fields.requirement_id ?? null, subsystem: fields.subsystem ?? null,
    caption: formStr(form, "caption"), kind: formStr(form, "kind"), content_type: file.type || null,
    uploaded_by: DEMO_EMAIL, uploaded_at: new Date().toISOString(),
  };
  db.media.push(row);
  return row;
}

function runSearch(db: DemoDB, q: URLSearchParams, today: string) {
  const get = (k: string) => q.get(k) || undefined;
  const text = get("q"); const subsystem = get("subsystem"); const kind = get("kind");
  const from = get("from"); const to = get("to"); const status = get("status");
  let rows = db.submissions.map((s) => ({ ...s, date: dateOf(db, s.meeting_day_id) ?? "", day_id: s.meeting_day_id }))
    .filter((s) => !text || (s.content ?? "").toLowerCase().includes(text.toLowerCase()))
    .filter((s) => !subsystem || s.subsystem === subsystem)
    .filter((s) => !kind || s.kind === kind)
    .filter((s) => !from || s.date >= from)
    .filter((s) => !to || s.date <= to)
    .sort((a, c) => c.date.localeCompare(a.date) || c.created_at.localeCompare(a.created_at));
  if (status) {
    const byDay = new Map<string, Rag>();
    for (const dayId of new Set(rows.map((r) => r.day_id))) {
      const d = db.meeting_days.find((x) => x.id === dayId)!;
      byDay.set(dayId, dayStatusFromDerived(d.date, today, deriveDay(db, dayId)));
    }
    rows = rows.filter((r) => byDay.get(r.day_id) === status);
  }
  return rows;
}

function buildDashboard(db: DemoDB, today: string) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addDaysUTC(today, -dow);
  const weekEnd = addDaysUTC(weekStart, 6);

  const dayStatuses = [...db.meeting_days]
    .sort((a, c) => a.date.localeCompare(c.date))
    .map((d) => ({ id: d.id, date: d.date, status: dayStatusFromDerived(d.date, today, deriveDay(db, d.id)) }));

  const deadlineStatuses = [...db.deadlines].sort((a, c) => a.due_date.localeCompare(c.due_date))
    .map((d) => ({ ...d, rag: deadlineRag({ status: d.status, due_date: d.due_date, today }) }));

  const redDays = dayStatuses.filter((d) => d.status === "red");
  const amberDays = dayStatuses.filter((d) => d.status === "amber");
  const overdue = deadlineStatuses.filter((d) => d.rag === "red");
  const dueSoon = deadlineStatuses.filter((d) => d.rag === "amber");

  let overall: Rag = "green";
  if (redDays.length || overdue.length) overall = "red";
  else if (amberDays.length || dueSoon.length) overall = "amber";

  const needsAttention = [
    ...redDays.map((d) => ({ type: "day" as const, id: d.id, date: d.date, label: `Meeting day ${d.date} has missing compulsory items` })),
    ...overdue.map((d) => ({ type: "deadline" as const, id: d.id, due_date: d.due_date, label: `${d.title} is overdue` })),
  ];

  const thisWeek = dayStatuses.filter((d) => d.date >= weekStart && d.date <= weekEnd);
  const upcomingDeadlines = deadlineStatuses.filter((d) => d.status !== "done")
    .map((d) => ({ id: d.id, title: d.title, due_date: d.due_date, status: d.rag, daysUntil: daysBetweenUTC(today, d.due_date) }))
    .sort((a, c) => a.due_date.localeCompare(c.due_date));

  return {
    today, overall,
    counts: { daysFlagged: redDays.length, deadlinesOverdue: overdue.length, deadlinesDueSoon: dueSoon.length },
    needsAttention, thisWeek, upcomingDeadlines,
  };
}
