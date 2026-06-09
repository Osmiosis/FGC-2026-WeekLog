import { Hono } from "hono";
import type { Env, Variables } from "../bindings";
import { requireUser } from "../auth";

export const committees = new Hono<{ Bindings: Env; Variables: Variables }>();

// The fixed committee list, for member-edit pickers. Any signed-in user can read.
committees.get("/", requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name FROM committees ORDER BY sort_order, name"
  ).all();
  return c.json(results);
});
