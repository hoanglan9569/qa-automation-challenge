#!/usr/bin/env bun
/**
 * Download the pinned k6 into .tools/k6/<version>/ (no-op when present).
 * The perf fixture does this on first use too; run it ahead of time in CI.
 *
 *   bun run k6:install
 */

import { ensureK6, K6_VERSION } from '@perf/k6-binary';

try {
  process.stdout.write(`k6 ${K6_VERSION}: ${await ensureK6()}\n`);
} catch (error: unknown) {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
