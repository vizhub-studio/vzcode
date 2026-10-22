import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.join(here, 'e2e', '.workspace');

/**
 * Browser end-to-end tests.
 *
 * These run against the real client (via the Vite dev server) and the real
 * VZCode backend (built from `createVZCodeServer`) pointed at a temporary
 * workspace that is reset from `e2e/fixtures/workspace` on every run.
 *
 * Specs use the `*.e2e.ts` suffix so Vitest never picks them up.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/start-backend.ts',
      url: 'http://localhost:3030/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        E2E_WORKSPACE: workspaceDir,
        E2E_BACKEND_PORT: '3030',
      },
    },
    {
      command: 'npx vite --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
