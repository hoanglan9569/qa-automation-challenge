/**
 * The single k6 script every performance case runs. What to run comes from
 * the Plan the Playwright side wrote (PLAN=<path>): which flow, its seeded
 * data, the load profile and the thresholds. New cases need no new script.
 */

import { Api, WARMUP } from '@k6/lib/api';
import { cartWrite } from '@k6/flows/cart-write';
import { catalog } from '@k6/flows/catalog';
import { login } from '@k6/flows/login';
import { viewCart } from '@k6/flows/view-cart';
import type { Flow, FlowData, Plan } from '@perf/plan';

const FLOWS: { [F in Flow]: (api: Api, data: FlowData[F]) => void } = {
  catalog,
  login,
  'view-cart': viewCart,
  'cart-write': cartWrite,
};

/** Unmeasured runs of the flow before the load starts, to absorb cold starts. */
const WARMUP_ITERATIONS = 2;

const plan = JSON.parse(open(required('PLAN'))) as Plan;
const api = new Api(plan.apiUrl);
const warmupApi = new Api(plan.apiUrl, false);

export const options = {
  scenarios: { [plan.flow]: { ...plan.scenario, exec: 'iteration' } },
  thresholds: {
    ...plan.thresholds,
    // Referenced only so the warm-up timings appear in the summary; never fails.
    [`http_req_duration{name:${WARMUP}}`]: ['max>=0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'],
};

export function setup(): void {
  for (let i = 0; i < WARMUP_ITERATIONS; i++) run(warmupApi, plan);
}

export function iteration(): void {
  run(api, plan);
}

function run<F extends Flow>(client: Api, { flow, data }: Plan<F>): void {
  FLOWS[flow](client, data);
}

function required(name: string): string {
  const value = __ENV[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set: k6/entry.ts is started by the perf fixture`);
  return value;
}
