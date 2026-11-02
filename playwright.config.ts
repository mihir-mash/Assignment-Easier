import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:15173",
    headless: true,
    viewport: { width: 1360, height: 980 },
    launchOptions: {
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
  },
  webServer: [
    {
      command: `${process.env.INKMATCH_PYTHON || "python"} -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 18000`,
      url: "http://127.0.0.1:18000/api/v1/health",
      reuseExistingServer: false,
    },
    {
      command:
        "npm run dev:frontend -- --host 127.0.0.1 --port 15173 --strictPort",
      url: "http://127.0.0.1:15173",
      env: { INKMATCH_API_TARGET: "http://127.0.0.1:18000" },
      reuseExistingServer: false,
    },
  ],
});
