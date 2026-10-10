/**
 * Runs k6 from a Playwright test: `k6.run(flow, data)` writes a plan, runs
 * k6/entry.ts on it and returns the summary for the test to assert on.
 *
 * k6/ is bundled with Bun first, because k6 cannot resolve the `@` aliases.
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { env } from '@config/env';
import { ROOT } from '@config/paths';
import { FLOW_METRICS, isPageTrend, type Flow, type FlowData, type Metric, type Plan } from '@perf/plan';
import { PROFILES, profileFromEnv, type Profile } from '@perf/profiles';
import { SLO } from '@perf/slos';
import { formatMs } from '@utils/date';

const ENTRY = join(ROOT, 'k6', 'entry.ts');
/** k6 exits with 99 when a threshold is crossed: the run itself completed. */
const THRESHOLDS_CROSSED = 99;

type SummaryMetric = { med?: number; 'p(95)'?: number; value?: number; count?: number };
type Summary = { metrics: Record<string, SummaryMetric | undefined> };

/** Bundle k6/entry.ts into `outDir`; returns the bundle path. */
export async function bundleK6(outDir: string): Promise<string> {
  const build = await Bun.build({
    entrypoints: [ENTRY],
    outdir: outDir,
    target: 'browser',
    format: 'esm',
    external: ['k6', 'k6/*'],
    tsconfig: join(ROOT, 'k6', 'tsconfig.json'),
  });
  if (!build.success) throw new AggregateError(build.logs, 'bundling k6/entry.ts failed');
  const bundle = join(outDir, 'entry.js');
  if (!existsSync(bundle)) throw new Error(`bundle not found at ${bundle}`);
  return bundle;
}

export class K6 {
  constructor(
    private readonly binary: string,
    private readonly bundle: string,
    private readonly testInfo: TestInfo,
  ) {}

  /** Run one flow under a load profile (default: $PERF_PROFILE, else smoke). */
  async run<F extends Flow>(
    flow: F,
    data: FlowData[F],
    { profile = profileFromEnv() }: { profile?: Profile } = {},
  ): Promise<K6Result> {
    const plan: Plan<F> = {
      flow,
      apiUrl: env.apiUrl,
      data,
      scenario: { ...PROFILES[profile] },
      thresholds: thresholds(flow),
    };
    const planPath = this.testInfo.outputPath('k6-plan.json');
    const summaryPath = this.testInfo.outputPath('k6-summary.json');
    // The plan holds session tokens: written for k6 only, deleted right after.
    writeFileSync(planPath, JSON.stringify(plan), { mode: 0o600 });

    try {
      const k6 = Bun.spawn(
        [
          this.binary,
          'run',
          '--quiet',
          '--no-color',
          '--no-usage-report',
          '--summary-mode',
          'compact',
          '--summary-export',
          summaryPath,
          '-e',
          `PLAN=${planPath}`,
          this.bundle,
        ],
        { stdout: 'pipe', stderr: 'pipe' },
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        k6.exited,
        new Response(k6.stdout).text(),
        new Response(k6.stderr).text(),
      ]);
      await this.testInfo.attach(`k6 ${flow} (${profile})`, { body: stdout, contentType: 'text/plain' });
      if (exitCode !== 0 && exitCode !== THRESHOLDS_CROSSED) {
        throw new Error(`k6 exited with ${exitCode}:\n${(stderr || stdout).slice(-2000)}`);
      }
      await this.testInfo.attach('k6-summary.json', { path: summaryPath, contentType: 'application/json' });
      const result = new K6Result(flow, (await Bun.file(summaryPath).json()) as Summary);
      for (const warning of result.warnings())
        this.testInfo.annotations.push({ type: 'perf warning', description: warning });
      return result;
    } finally {
      rmSync(planPath, { force: true });
    }
  }
}

export class K6Result {
  constructor(
    readonly flow: Flow,
    private readonly summary: Summary,
  ) {}

  /** Median in ms of an endpoint's requests or of a page trend; NaN when nothing was recorded. */
  med(metric: Metric): number {
    return this.summary.metrics[metricKey(metric)]?.med ?? Number.NaN;
  }

  /** p95 in ms of an endpoint's requests or of a page trend; NaN when nothing was recorded. */
  p95(metric: Metric): number {
    return this.summary.metrics[metricKey(metric)]?.['p(95)'] ?? Number.NaN;
  }

  /** Share of HTTP requests that failed (0..1). */
  get errorRate(): number {
    return this.summary.metrics.http_req_failed?.value ?? Number.NaN;
  }

  /** Share of k6 checks that passed (0..1). */
  get checkRate(): number {
    return this.summary.metrics.checks?.value ?? Number.NaN;
  }

  get iterations(): number {
    return this.summary.metrics.iterations?.count ?? 0;
  }

  /** Every gating budget this run broke, one readable line each; empty when within budget. */
  breaches(): string[] {
    const breaches: string[] = [];
    for (const metric of FLOW_METRICS[this.flow]) {
      const { med, p95 } = SLO.budgets[metric];
      if (!(this.med(metric) < med))
        breaches.push(`${metric}: median ${formatMs(this.med(metric))}, budget ${formatMs(med)}`);
      if (!(this.p95(metric) < p95))
        breaches.push(`${metric}: p95 ${formatMs(this.p95(metric))}, ceiling ${formatMs(p95)}`);
    }
    if (!(this.errorRate <= SLO.maxErrorRate))
      breaches.push(`errors: ${percent(this.errorRate)}, budget ${percent(SLO.maxErrorRate)}`);
    if (!(this.checkRate >= SLO.minCheckRate))
      breaches.push(`checks: ${percent(this.checkRate)} passed, budget ${percent(SLO.minCheckRate)}`);
    return breaches;
  }

  /** Target p95s this run missed: reported, never failed. */
  warnings(): string[] {
    return FLOW_METRICS[this.flow]
      .filter((metric) => !(this.p95(metric) < SLO.budgets[metric].targetP95))
      .map(
        (metric) => `${metric}: p95 ${formatMs(this.p95(metric))}, target ${formatMs(SLO.budgets[metric].targetP95)}`,
      );
  }
}

/** The gating budgets as k6 thresholds, so k6's own summary marks them ✓/✗. */
function thresholds(flow: Flow): Record<string, string[]> {
  const result: Record<string, string[]> = {
    http_req_failed: [`rate<=${SLO.maxErrorRate}`],
    checks: [`rate>=${SLO.minCheckRate}`],
  };
  for (const metric of FLOW_METRICS[flow]) {
    const { med, p95 } = SLO.budgets[metric];
    result[metricKey(metric)] = [`med<${med}`, `p(95)<${p95}`];
  }
  return result;
}

/** Summary key of a metric: a page trend by name, an endpoint as a tagged sub-metric. */
function metricKey(metric: Metric): string {
  return isPageTrend(metric) ? metric : `http_req_duration{name:${metric}}`;
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}
