/**
 * Loads env/.env.<TEST_ENV> (then env/.env.<TEST_ENV>.local, if present) into
 * process.env once per process, validates it and exposes it typed. Variables
 * already set in the shell or CI win over both files.
 *
 *   TEST_ENV=production bun run test
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type } from 'arktype';
import { config } from 'dotenv';
import { ROOT } from '@config/paths';

const Environment = type("'staging' | 'production'");
export type Environment = typeof Environment.infer;

/** What every env file must define; anything else in process.env is ignored. */
const Variables = type({
  BASE_URL: 'string.url',
  API_URL: 'string.url',
  /** Comma-separated saved accounts global setup logs in. */
  'PRELOGIN_ACCOUNTS?': 'string',
});

const name = Environment(process.env.TEST_ENV ?? 'staging');
if (name instanceof type.errors) throw new Error(`TEST_ENV ${name.summary}`);

const files = [`.env.${name}.local`, `.env.${name}`]
  .map((file) => join(ROOT, 'env', file))
  .filter((file) => existsSync(file));
if (files.length === 0) throw new Error(`no env file for TEST_ENV=${name} (expected env/.env.${name})`);
// First file wins per key, and nothing overrides the real environment.
config({ path: files, quiet: true });

const variables = Variables(process.env);
if (variables instanceof type.errors) throw new Error(`invalid env (TEST_ENV=${name}): ${variables.summary}`);

/** A required variable; throws with the variable name when it is missing. */
export function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') throw new Error(`${key} is not set (TEST_ENV=${env.name})`);
  return value.trim();
}

export const env = {
  name,
  baseUrl: variables.BASE_URL,
  apiUrl: variables.API_URL,
  preloginAccounts: (variables.PRELOGIN_ACCOUNTS ?? '')
    .split(',')
    .map((account) => account.trim())
    .filter(Boolean),
} as const;
