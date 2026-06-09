// Minimal adapter that lets Worker route code (written against the D1 API)
// run against an in-memory better-sqlite3 database in tests.
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function sqlFile(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

class StmtShim {
  private args: unknown[] = [];
  constructor(private db: Database.Database, private sql: string) {}

  bind(...args: unknown[]): this {
    this.args = args;
    return this;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    const rows = this.db.prepare(this.sql).all(...this.args) as T[];
    return { results: rows, success: true };
  }

  async first<T = unknown>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.args) as T | undefined;
    return row ?? null;
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const info = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: info.changes } };
  }
}

export class D1Shim {
  constructor(private db: Database.Database) {}
  prepare(sql: string): StmtShim {
    return new StmtShim(this.db, sql);
  }
}

// A fresh in-memory DB with schema + seed + roster applied, wrapped as a D1Shim.
export function makeTestDb(): D1Shim {
  const db = new Database(":memory:");
  db.exec(sqlFile("../../migrations/0001_init.sql"));
  db.exec(sqlFile("../../migrations/0002_seed.sql"));
  db.exec(sqlFile("../../migrations/0003_media_content_type.sql"));
  db.exec(sqlFile("../../seed/roster.sql"));
  return new D1Shim(db);
}

// Minimal in-memory stand-in for an R2 bucket binding (put/get/delete).
export function makeR2Stub() {
  const store = new Map<string, Uint8Array>();
  return {
    async put(key: string, value: ArrayBuffer | Uint8Array) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      store.set(key, bytes);
      return { key };
    },
    async get(key: string) {
      const v = store.get(key);
      if (!v) return null;
      return { body: v, arrayBuffer: async () => v.buffer };
    },
    async delete(key: string) {
      store.delete(key);
    },
    _store: store,
  };
}

// Test Env factory. fetch is stubbed per-test to resolve the bearer token.
export function testEnv(db: D1Shim): Record<string, unknown> {
  return {
    DB: db,
    MEDIA: makeR2Stub(),
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon",
    ADMIN_EMAIL: "vibha.aarav@gmail.com",
  };
}

// Stub global fetch so Supabase token verification resolves deterministically.
// "admin-token" -> the admin email; "member-token" -> a member; anything else -> 401.
export function stubSupabaseAuth(): void {
  const fn = async (_url: string, init?: { headers?: Record<string, string> }) => {
    const auth = init?.headers?.Authorization ?? "";
    if (auth.includes("admin-token")) {
      return new Response(
        JSON.stringify({ id: "u-admin", email: "vibha.aarav@gmail.com" }),
        { status: 200 }
      );
    }
    if (auth.includes("member-token")) {
      return new Response(JSON.stringify({ id: "u-mem", email: "kid@example.com" }), {
        status: 200,
      });
    }
    return new Response("invalid", { status: 401 });
  };
  // @ts-expect-error replacing global fetch for tests
  globalThis.fetch = fn;
}
