import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Repository root, independent of the working directory. */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Saved storage states: .auth/<env>/<account>.json (gitignored). */
export const AUTH_DIR = join(ROOT, '.auth');

/** Playwright's browsers, kept in the repo like k6 (gitignored); `bun run browsers` installs here. */
export const BROWSERS_DIR = join(ROOT, '.tools', 'ms-playwright');
