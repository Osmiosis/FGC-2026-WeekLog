import { describe, it, expect, beforeEach } from "vitest";
import { storeToken, getStoredToken, clearToken, TOKEN_KEY } from "./auth-client";

describe("bearer token storage", () => {
  beforeEach(() => localStorage.clear());

  it("stores and reads the bearer token", () => {
    storeToken("abc123");
    expect(getStoredToken()).toBe("abc123");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc123");
  });

  it("clears the token", () => {
    storeToken("abc123");
    clearToken();
    expect(getStoredToken()).toBeNull();
  });
});
