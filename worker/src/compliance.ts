// Pure compliance engine (PRD 6.1). No I/O: `today` is injected so results are
// deterministic and testable. ISO YYYY-MM-DD dates compare lexicographically.

export type Rag = "green" | "amber" | "red";

export function daysBetweenUTC(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// A meeting day's red/amber/green status.
export function dayRag(input: {
  date: string;
  today: string;
  compulsoryTotal: number;
  compulsorySatisfied: number;
}): Rag {
  const { date, today, compulsoryTotal, compulsorySatisfied } = input;
  if (compulsoryTotal === 0 || compulsorySatisfied >= compulsoryTotal) {
    return "green";
  }
  // Some compulsory items are still missing.
  if (date < today) return "red"; // past and incomplete (includes a missed day)
  return "amber"; // today or future, in progress
}

// A standalone deadline's red/amber/green status.
export function deadlineRag(input: {
  status: string;
  due_date: string;
  today: string;
}): Rag {
  if (input.status === "done") return "green";
  if (input.due_date < input.today) return "red"; // open and overdue
  if (daysBetweenUTC(input.today, input.due_date) <= 7) return "amber"; // due soon
  return "green"; // open, further out
}
