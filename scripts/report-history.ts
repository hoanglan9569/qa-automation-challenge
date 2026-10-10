#!/usr/bin/env bun
/**
 * Report history for GitHub Pages: adds this CI run's merged HTML report to
 * the site, drops the oldest runs and rebuilds the index. The workflow keeps
 * the site on the gh-pages branch and deploys it.
 *
 *   bun run scripts/report-history.ts <site dir> <report dir>
 *
 * The site holds runs/<run number>/ (that run's report, plus run.json),
 * latest/ (sends you to the newest run) and index.html (every run, newest
 * first). Run details come from the GitHub Actions environment, test counts
 * from the report's results.json (Playwright's JSON reporter).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JSONReport } from '@playwright/test/reporter';
import { DateFormat, formatDate, formatDuration, fromIso } from '@utils/date';

/** The newest runs kept, and how much they may weigh together (a Pages site stops at 1 GB). */
const MAX_RUNS = 100;
const MAX_MB = 500;

interface Run {
  number: number;
  /** The run's page on GitHub, with its logs. */
  url: string;
  trigger: string;
  sha: string;
  subject: string;
  /** ISO 8601. */
  startTime: string;
  /** ms */
  duration: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
}

try {
  const [siteDir, reportDir] = Bun.argv.slice(2);
  if (siteDir === undefined || reportDir === undefined)
    throw new Error('usage: report-history.ts <site dir> <report dir>');
  const runsDir = join(siteDir, 'runs');

  const run = currentRun(reportDir);
  const runDir = join(runsDir, String(run.number));
  rmSync(runDir, { recursive: true, force: true }); // a re-run replaces the earlier attempt
  cpSync(reportDir, runDir, { recursive: true });
  writeFileSync(join(runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);

  const runs = prune(runsDir, readRuns(runsDir));
  writeFileSync(join(siteDir, 'index.html'), renderIndex(runs));
  mkdirSync(join(siteDir, 'latest'), { recursive: true });
  writeFileSync(join(siteDir, 'latest', 'index.html'), renderRedirect(run.number));
  process.stdout.write(`report history: run #${run.number} added, ${runs.length} runs kept\n`);
} catch (error: unknown) {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function currentRun(reportDir: string): Run {
  const { stats } = JSON.parse(readFileSync(join(reportDir, 'results.json'), 'utf8')) as JSONReport;
  const sha = env('GITHUB_SHA');
  return {
    number: Number(env('GITHUB_RUN_NUMBER')),
    url: `${repoUrl()}/actions/runs/${env('GITHUB_RUN_ID')}`,
    trigger: trigger(),
    sha,
    subject: commitSubject(sha),
    startTime: stats.startTime,
    duration: stats.duration,
    passed: stats.expected,
    failed: stats.unexpected,
    flaky: stats.flaky,
    skipped: stats.skipped,
  };
}

/** How the run started; for a manual run, with what it was given. */
function trigger(): string {
  const event = env('GITHUB_EVENT_NAME');
  if (event === 'schedule') return 'nightly';
  if (event !== 'workflow_dispatch') return event;
  return `manual: ${env('TEST_ENV')}, ${env('SUITE')} suite, ${env('PERF_PROFILE')} load`;
}

function commitSubject(sha: string): string {
  const git = Bun.spawnSync(['git', 'log', '-1', '--format=%s', sha]);
  return git.success ? git.stdout.toString().trim() : '';
}

/** Every run on the site, newest first. */
function readRuns(runsDir: string): Run[] {
  return readdirSync(runsDir)
    .map((name) => join(runsDir, name, 'run.json'))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, 'utf8')) as Run)
    .sort((a, b) => b.number - a.number);
}

/** Keeps the newest runs within MAX_RUNS and MAX_MB (always the newest one) and deletes the rest. */
function prune(runsDir: string, runs: Run[]): Run[] {
  let bytes = 0;
  return runs.filter((run, index) => {
    const dir = join(runsDir, String(run.number));
    bytes += size(dir);
    const keep = index === 0 || (index < MAX_RUNS && bytes <= MAX_MB * 1024 ** 2);
    if (!keep) rmSync(dir, { recursive: true, force: true });
    return keep;
  });
}

function size(path: string): number {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((total, name) => total + size(join(path, name)), 0);
}

function renderIndex(runs: Run[]): string {
  const rows = runs.map((run) => {
    const status = run.failed > 0 ? 'failed' : run.flaky > 0 ? 'flaky' : 'passed';
    const counts = [
      run.failed > 0 ? `${run.failed} failed` : '',
      `${run.passed} passed`,
      run.flaky > 0 ? `${run.flaky} flaky` : '',
      run.skipped > 0 ? `${run.skipped} skipped` : '',
    ].filter(Boolean);
    return `
      <tr class="${status}">
        <td><a href="runs/${run.number}/">#${run.number}</a></td>
        <td class="result">${{ failed: '✘', flaky: '⚠', passed: '✔' }[status]} ${counts.join(' · ')}</td>
        <td>${escapeHtml(formatDate(fromIso(run.startTime), DateFormat.LOG))}</td>
        <td>${formatDuration(run.duration)}</td>
        <td>${escapeHtml(run.trigger)}</td>
        <td class="commit"><a href="${repoUrl()}/commit/${run.sha}"><code>${run.sha.slice(0, 7)}</code></a> ${escapeHtml(run.subject)}</td>
        <td><a href="${escapeHtml(run.url)}">logs</a></td>
      </tr>`;
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Test reports · ${escapeHtml(env('GITHUB_REPOSITORY'))}</title>
  <style>
    :root { color-scheme: light dark; --fg: #1f2328; --muted: #59636e; --bg: #fff; --line: #d1d9e0;
      --link: #0969da; --passed: #1a7f37; --failed: #d1242f; --flaky: #9a6700; }
    @media (prefers-color-scheme: dark) {
      :root { --fg: #f0f6fc; --muted: #9198a1; --bg: #0d1117; --line: #3d444d;
        --link: #4493f8; --passed: #3fb950; --failed: #f85149; --flaky: #d29922; }
    }
    body { max-width: 1200px; margin: 0 auto; padding: 24px 16px; font: 14px/1.5 system-ui, sans-serif;
      color: var(--fg); background: var(--bg); }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p { margin: 0 0 16px; color: var(--muted); }
    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
    th { color: var(--muted); font-weight: 600; }
    td.commit { white-space: normal; min-width: 240px; }
    tr.passed .result { color: var(--passed); }
    tr.failed .result { color: var(--failed); }
    tr.flaky .result { color: var(--flaky); }
    code { font: 12px ui-monospace, monospace; }
  </style>
</head>
<body>
  <h1>Test reports</h1>
  <p>
    Every run of <a href="${repoUrl()}/actions">${escapeHtml(env('GITHUB_WORKFLOW'))}</a> on <code>main</code>, newest
    first, each with its own Playwright report. The last ${MAX_RUNS} runs are kept, up to ${MAX_MB} MB.
    <a href="latest/">Latest report →</a>
  </p>
  <div class="scroll">
    <table>
      <thead>
        <tr><th>Run</th><th>Result</th><th>Started</th><th>Took</th><th>Trigger</th><th>Commit</th><th></th></tr>
      </thead>
      <tbody>${rows.join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
`;
}

function renderRedirect(runNumber: number): string {
  const target = `../runs/${runNumber}/`;
  return `<!doctype html>
<meta charset="utf-8">
<title>Latest test report</title>
<meta http-equiv="refresh" content="0; url=${target}">
<a href="${target}">Run #${runNumber}</a>
`;
}

function repoUrl(): string {
  return `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}`;
}

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set (this runs in GitHub Actions)`);
  return value;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
