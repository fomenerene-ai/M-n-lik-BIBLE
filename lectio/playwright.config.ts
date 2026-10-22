import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM permet d'utiliser un Chromium déjà installé (environnement cloud).
// Sur ta machine, `npx playwright install chromium` suffit et cette variable reste vide.
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
    locale: 'fr-FR',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'tablette',
      use: { ...devices['Galaxy Tab S9 landscape'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
