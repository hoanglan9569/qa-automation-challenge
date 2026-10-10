import type { Metric } from '@perf/plan';

export interface Budget {
  /** Gate: median in ms — the typical user. Stable run to run, so it can fail a test. */
  med: number;
  /** Gate: p95 ceiling in ms — only a real degradation crosses it. */
  p95: number;
  /** Target p95 in ms: crossing it is reported as a warning, not a failure. */
  targetP95: number;
}

/**
 * Calibrated on repeated smoke runs. Medians are steady (~270–310 ms), but
 * single calls spike to 1–1.8 s, and over ~30 samples two spikes decide the
 * p95. So the gate is the median plus a generous p95 ceiling; the real p95
 * target only warns.
 */
const REQUEST: Budget = { med: 500, p95: 2000, targetP95: 800 };

export const SLO = {
  budgets: {
    entries: REQUEST,
    view: REQUEST,
    login: REQUEST,
    check: REQUEST,
    viewcart: REQUEST,
    addtocart: REQUEST,
    deleteitem: REQUEST,
    /** /viewcart + one /view per line (6 in parallel per host): ~555 ms at 1 line, ~870 ms at 10. */
    cart_page: { med: 1500, p95: 3500, targetP95: 1500 },
  } satisfies Record<Metric, Budget>,
  /** Share of HTTP requests that may fail. */
  maxErrorRate: 0.01,
  /** Share of k6 checks (response correctness) that must pass. */
  minCheckRate: 0.99,
} as const;
