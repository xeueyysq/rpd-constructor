import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig, devices } from '@playwright/test';

const e2eEnv = parseEnv(readFileSync(new URL('./e2e.env', import.meta.url), 'utf8'));

const apiUrl = e2eEnv.API_URL!;
const clientUrl = e2eEnv.CLIENT_URL!;
const serverEnv = { ...process.env, ...e2eEnv };

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: clientUrl, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bun run start',
      cwd: '../rpd-server',
      env: serverEnv,
      url: `${apiUrl}/resource/protected`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `bun run dev --host localhost --port ${new URL(clientUrl).port} --strictPort`,
      cwd: '../rpd-client-ts',
      env: { ...serverEnv, VITE_API_URL: e2eEnv.VITE_API_URL! },
      url: clientUrl,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
