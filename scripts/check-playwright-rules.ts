import { join } from 'node:path';
import { formatFinding, lintTree } from './playwright-lint';

const ROOT = join(import.meta.dir, '..');

const findings = lintTree(ROOT, ['src', 'tests'], {
  skipFiles: ['scripts/playwright-lint.ts'],
});

if (findings.length > 0) {
  for (const f of findings) {
    console.error(formatFinding(f));
  }
  process.exit(1);
} else {
  console.log('Playwright rules check passed: 0 findings.');
}
