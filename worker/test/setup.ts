import { vi } from "vitest";

// Resolve Better Auth sessions from the bearer token in tests.
// "admin-token" -> the admin user; "member-token" -> a member; anything else -> null.
vi.mock("better-auth", () => ({
  betterAuth: () => ({
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const auth = headers.get("authorization") ?? "";
        if (auth.includes("admin-token")) return { user: { id: "u-admin", email: "vibha.aarav@gmail.com" } };
        if (auth.includes("member-token")) return { user: { id: "u-mem", email: "kid@example.com" } };
        return null;
      },
    },
    handler: async () => new Response(null),
  }),
}));
vi.mock("better-auth/plugins", () => ({ bearer: () => ({}) }));
vi.mock("kysely-d1", () => ({ D1Dialect: class {} }));
