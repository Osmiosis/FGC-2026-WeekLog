import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";
import { deadlineRag, daysBetweenUTC, addDaysUTC, type Rag } from "../compliance";
import { deriveDay, dayStatusFromDerived, todayUTC } from "../dayStatus";

export const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

// Aggregate team documentation health (PRD 6.4).
dashboard.get("/", requireUser, async (c) => {
  const today = todayUTC();

  // Week (Sunday..Saturday) containing today.
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addDaysUTC(today, -dow);
  const weekEnd = addDaysUTC(weekStart, 6);

  // Every meeting day with its live-derived status.
  const days = await c.env.DB.prepare(
    "SELECT id, date FROM meeting_days ORDER BY date"
  ).all<{ id: string; date: string }>();
  const dayStatuses = await Promise.all(
    days.results.map(async (d) => {
      const derived = await deriveDay(c.env, d.id);
      return { id: d.id, date: d.date, status: dayStatusFromDerived(d.date, today, derived) };
    })
  );

  // Every deadline with its derived status.
  const dl = await c.env.DB.prepare("SELECT * FROM deadlines ORDER BY due_date").all<{
    id: string;
    title: string;
    due_date: string;
    status: string;
  }>();
  const deadlineStatuses = dl.results.map((d) => ({
    ...d,
    rag: deadlineRag({ status: d.status, due_date: d.due_date, today }),
  }));

  const redDays = dayStatuses.filter((d) => d.status === "red");
  const amberDays = dayStatuses.filter((d) => d.status === "amber");
  const overdueDeadlines = deadlineStatuses.filter((d) => d.rag === "red");
  const dueSoonDeadlines = deadlineStatuses.filter((d) => d.rag === "amber");

  let overall: Rag = "green";
  if (redDays.length || overdueDeadlines.length) overall = "red";
  else if (amberDays.length || dueSoonDeadlines.length) overall = "amber";

  const needsAttention = [
    ...redDays.map((d) => ({
      type: "day" as const,
      id: d.id,
      date: d.date,
      label: `Meeting day ${d.date} has missing compulsory items`,
    })),
    ...overdueDeadlines.map((d) => ({
      type: "deadline" as const,
      id: d.id,
      due_date: d.due_date,
      label: `${d.title} is overdue`,
    })),
  ];

  const thisWeek = dayStatuses.filter((d) => d.date >= weekStart && d.date <= weekEnd);

  const upcomingDeadlines = deadlineStatuses
    .filter((d) => d.status !== "done")
    .map((d) => ({
      id: d.id,
      title: d.title,
      due_date: d.due_date,
      status: d.rag,
      daysUntil: daysBetweenUTC(today, d.due_date),
    }))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return c.json({
    today,
    overall,
    counts: {
      daysFlagged: redDays.length,
      deadlinesOverdue: overdueDeadlines.length,
      deadlinesDueSoon: dueSoonDeadlines.length,
    },
    needsAttention,
    thisWeek,
    upcomingDeadlines,
  });
});
