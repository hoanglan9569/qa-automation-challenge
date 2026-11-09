import { toMs } from '@utils/date';

/**
 * Every wait budget, in ms (owner rule
 * RULE-TIMEOUTS-FROM-A-TIMEOUT-ENUM-LIKE-OMNIA-DEFAULT-UNLESS-NO-SIGNAL).
 */
export const Timeout = {
  IMMEDIATE: 0,
  EXTREME_SHORT: 50,
  VERY_SHORT: 1_000,
  SHORT: 5_000,
  DEFAULT: 15_000,
  LONG: 60_000,
  VERY_LONG: 120_000,
  MAX: 240_000,

  /** One test: a whole purchase on a public site, with room for its occasional multi-second stalls. */
  TEST: toMs({ minutes: 1 }),
  /** One performance case: warm-up plus the longest load profile, with margin. */
  PERF_TEST: toMs({ minutes: 10 }),
  /** One action (click, fill, waitFor…) or API request. Navigations are bounded by TEST alone. */
  ACTION: 15_000,
  /** One web-first assertion (`expect`), negative ones like `toBeHidden` included. */
  EXPECT: 15_000,
  /** A page finishing its own async work after load, e.g. every product image arriving. */
  SETTLE: 15_000,
} as const;

export type Timeout = (typeof Timeout)[keyof typeof Timeout];
