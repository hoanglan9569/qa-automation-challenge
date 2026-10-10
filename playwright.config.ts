import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { env } from '@config/env';
import { BROWSERS_DIR } from '@config/paths';
import { Timeout } from '@config/timeouts';

// Workers inherit this, so they launch the browsers `bun run browsers` put in the repo —
// unless it is already set, as in the Playwright Docker image CI runs in (/ms-playwright).
process.env.PLAYWRIGHT_BROWSERS_PATH ??= BROWSERS_DIR;

const CI = Boolean(process.env.CI);
/** Headed locally, to watch the run; headless on CI, and on a Linux box with no display to open windows on. */
const HEADLESS = CI || (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY);
/** Desktop page size (Playwright's desktop default, pinned). Mobile projects keep their device's. */
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

const reporter: ReporterDescription[] = [['list'], ['html', { open: 'never' }]];
// Any CI: a JUnit file for its test view (Jenkins, GitLab CI, …).
if (CI) reporter.push(['junit', { outputFile: 'test-results/junit.xml' }]);
// GitHub Actions: failures as annotations on the run, and a blob report per job,
// which the workflow merges into one HTML report.
if (process.env.GITHUB_ACTIONS) reporter.push(['github'], ['blob']);

export default defineConfig({
  testDir: './tests',
  globalSetup: './src/global-setup.ts',
  timeout: Timeout.TEST,
  expect: { timeout: Timeout.EXPECT },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter,
  use: {
    baseURL: env.baseUrl,
    headless: HEADLESS,
    actionTimeout: Timeout.ACTION,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    // The default matrix: browsers Playwright downloads itself (`bun run
    // browsers`), so it is the same on Windows, macOS and Linux and needs
    // nothing preinstalled on the machine.
    { name: 'chromium', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'], viewport: DESKTOP_VIEWPORT } },
    {
      name: 'firefox',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Firefox'],
        viewport: DESKTOP_VIEWPORT,
        // Headed on Windows, Firefox stops painting a window that other windows cover, so
        // with parallel workers Playwright's "element is stable" check never gets a frame.
        launchOptions: { firefoxUserPrefs: { 'widget.windows.window_occlusion_tracking.enabled': false } },
        // Recording a visible Firefox window (video, trace screenshots) makes a run ~4x
        // slower and can hang closing a context, so headed it keeps the trace's DOM only.
        ...(HEADLESS ? {} : { video: 'off', trace: { mode: 'retain-on-failure', screenshots: false } }),
      },
    },
    { name: 'webkit', testDir: './tests/e2e', use: { ...devices['Desktop Safari'], viewport: DESKTOP_VIEWPORT } },
    // Mobile emulation, on those same downloaded browsers: the critical @smoke
    // path only, to keep the matrix quick.
    { name: 'mobile-chrome', testDir: './tests/e2e', grep: /@smoke/, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', testDir: './tests/e2e', grep: /@smoke/, use: { ...devices['iPhone 15'] } },
    // Opt-in (`bun run test:branded`): the real Chrome and Edge builds, which
    // only run where they are already installed — not on a clean CI box.
    {
      name: 'chrome',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: DESKTOP_VIEWPORT },
    },
    {
      name: 'edge',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: DESKTOP_VIEWPORT },
    },
    // k6 load runs. Always run alone with --workers=1 (`bun run perf`): parallel
    // load against the same target skews every measurement. No retries — a
    // retried performance result hides the slow run it replaced.
    { name: 'perf', testDir: './tests/perf', timeout: Timeout.PERF_TEST, retries: 0 },
  ],
});
