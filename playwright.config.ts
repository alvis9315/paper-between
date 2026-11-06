import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:5178",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: true,
  },
});
