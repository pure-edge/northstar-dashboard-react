import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Uses the Microsoft Edge already installed on Windows, so no browser download is needed.
    channel: 'msedge',
  },
  webServer: {
    // Tests run against a production build served statically, which stays stable
    // when several browsers load the page in parallel.
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
