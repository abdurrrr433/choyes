import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Only *.test.ts(x) belong to Vitest. *.spec.ts(x) is reserved for Playwright
    // E2E specs (see playwright.config.ts testMatch) and must not be collected here,
    // or Vitest tries to run Playwright's test.describe() and crashes.
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
