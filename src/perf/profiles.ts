/**
 * Load shapes, as k6 scenarios (arrival-rate: iterations per second,
 * independent of response times). Every target is someone else's public demo
 * site, so `smoke` is deliberately tiny and `load` is opt-in only.
 *
 *   PERF_PROFILE=load bun run perf
 */
export const PROFILES = {
  /** 2 iterations/s for 15 s: is it fast and correct at all? Default. */
  smoke: {
    executor: 'constant-arrival-rate',
    rate: 2,
    timeUnit: '1s',
    duration: '15s',
    preAllocatedVUs: 2,
    maxVUs: 5,
  },
  /** Ramp to 5 iterations/s, hold 1 min, ramp down: does it hold under sustained load? */
  load: {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs: 5,
    maxVUs: 15,
    stages: [
      { target: 5, duration: '30s' },
      { target: 5, duration: '1m' },
      { target: 0, duration: '15s' },
    ],
  },
} as const;

export type Profile = keyof typeof PROFILES;

export function profileFromEnv(): Profile {
  const name = process.env.PERF_PROFILE ?? 'smoke';
  if (!(name in PROFILES))
    throw new Error(`PERF_PROFILE must be one of ${Object.keys(PROFILES).join(', ')}, got "${name}"`);
  return name as Profile;
}
