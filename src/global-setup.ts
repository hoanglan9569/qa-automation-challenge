/**
 * Runs once before all workers. Importing env loads env/.env.<TEST_ENV>; each
 * account in PRELOGIN_ACCOUNTS then gets a verified storage state, so workers
 * only ever read .auth/ and never race to log in.
 */

import { isSavedAccount } from '@auth/accounts';
import { session } from '@auth/session';
import { env } from '@config/env';
import { DateFormat, formatDate, fromEpochSeconds } from '@utils/date';

export default async function globalSetup(): Promise<void> {
  for (const name of env.preloginAccounts) {
    if (!isSavedAccount(name)) throw new Error(`PRELOGIN_ACCOUNTS: "${name}" is not a saved account`);
    const { expiresAt } = await session(name, { verify: true });
    const until = formatDate(fromEpochSeconds(expiresAt), DateFormat.LOG);
    console.log(`[global-setup] ${env.name}: ${name} session valid until ${until}`);
  }
}
