import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:4112",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    { name: "chrome", use: { browserName: "chromium", channel: "chrome" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "npm run dev -- --port 4112 --strictPort",
    url: "http://127.0.0.1:4112",
    reuseExistingServer: true,
  },
});
