import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement the Object URL APIs, which the demo media layer uses
// (createObjectURL in store/media, revokeObjectURL in hooks/api). Provide tiny
// stubs so demo-layer code is exercisable under test.
if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  URL.createObjectURL = () => `blob:demo/${++n}`;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

afterEach(() => cleanup());
