/**
 * The contract between the Playwright side (seeds data, starts k6, judges the
 * result) and the k6 side (k6/entry.ts runs one flow under one load profile).
 * Pure types and data only: this file is bundled into the k6 script too.
 */

/** Requests are tagged with `name: <Endpoint>`, so every endpoint gets its own timings. */
export type Endpoint = 'entries' | 'view' | 'login' | 'check' | 'viewcart' | 'addtocart' | 'deleteitem';

/** Custom trends a flow records on top of per-request timings. */
export const PAGE_TRENDS = ['cart_page'] as const;
export type PageTrend = (typeof PAGE_TRENDS)[number];

export function isPageTrend(metric: string): metric is PageTrend {
  return (PAGE_TRENDS as readonly string[]).includes(metric);
}

export type Metric = Endpoint | PageTrend;

/** Input each flow needs, prepared by the test before k6 starts. */
export interface FlowData {
  /** Guest browsing: the home page's /entries, then a product's /view. */
  catalog: { productIds: number[] };
  /** /login then /check with a throwaway user's credentials. */
  login: { username: string; password: string };
  /** What the cart page does: /viewcart, then one /view per line, in parallel. */
  'view-cart': { token: string; lines: number };
  /** Add a line, see it in the cart, delete that same line (never /deletecart). */
  'cart-write': { token: string; productId: number };
}

export type Flow = keyof FlowData;

/** What each flow measures; the runner turns these into k6 thresholds and SLO checks. */
export const FLOW_METRICS = {
  catalog: ['entries', 'view'],
  login: ['login', 'check'],
  'view-cart': ['viewcart', 'view', 'cart_page'],
  'cart-write': ['addtocart', 'viewcart', 'deleteitem'],
} as const satisfies Record<Flow, readonly Metric[]>;

/** Written to a JSON file by the runner and read by k6/entry.ts with open(). */
export interface Plan<F extends Flow = Flow> {
  flow: F;
  apiUrl: string;
  data: FlowData[F];
  /** A k6 scenario without `exec` (executor, rate, duration, VUs …). */
  scenario: Record<string, unknown>;
  thresholds: Record<string, string[]>;
}
