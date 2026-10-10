import { toMs } from '@utils/date';

/**
 * Every wait budget, in ms. playwright.config.ts sets Playwright's defaults from
 * these; code passes one explicitly only when it must wait longer than `expect`.
 *
 * ACTION and EXPECT are 10 s, not Playwright's 5 s: pages fill in over several API
 * calls, and a busy machine (parallel browsers, all recording video) can stall
 * them for seconds.
 */
export const Timeout = {
  /** One test: a whole purchase on a public site, with room for its occasional multi-second stalls. */
  TEST: toMs({ minutes: 1 }),
  /** One performance case: warm-up plus the longest load profile, with margin. */
  PERF_TEST: toMs({ minutes: 10 }),
  /** One action (click, fill, waitFor…) or API request. Navigations are bounded by TEST alone. */
  ACTION: toMs({ seconds: 10 }),
  /** One web-first assertion (`expect`), negative ones like `toBeHidden` included. */
  EXPECT: toMs({ seconds: 10 }),
  /** A page finishing its own async work after load, e.g. every product image arriving. */
  SETTLE: toMs({ seconds: 15 }),
} as const;
