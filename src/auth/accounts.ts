import { required } from '@config/env';
import { decrypt, isEncrypted } from '@utils/crypto';

/**
 * Who a browser context or API call acts as.
 *
 *   ADMIN     saved account: credentials in the env files, session cached in .auth/
 *   GUEST     no session
 *   NEW_USER  a throwaway user signed up on demand, one per test — for flows that
 *             mutate per-user state (the cart) and must not collide in parallel
 *
 * Adding a saved account: add a member here, then <NAME>_USERNAME /
 * <NAME>_PASSWORD (enc1.… tokens) to every env file.
 */
export const Account = {
  ADMIN: 'admin',
  GUEST: 'guest',
  NEW_USER: 'new-user',
} as const;
export type Account = (typeof Account)[keyof typeof Account];

/** Accounts whose credentials live in the env files. */
export type SavedAccount = Exclude<Account, typeof Account.GUEST | typeof Account.NEW_USER>;

export interface Credentials {
  username: string;
  password: string;
}

export function isSavedAccount(value: string): value is SavedAccount {
  return (Object.values(Account) as string[]).includes(value) && value !== Account.GUEST && value !== Account.NEW_USER;
}

/** Decrypted credentials of a saved account, read from <NAME>_USERNAME / <NAME>_PASSWORD. */
export function credentials(account: SavedAccount): Credentials {
  const prefix = account.toUpperCase();
  return { username: secret(`${prefix}_USERNAME`), password: secret(`${prefix}_PASSWORD`) };
}

function secret(key: string): string {
  const value = required(key);
  if (!isEncrypted(value)) throw new Error(`${key} must be an enc1.… token (bun run crypto encrypt), not plaintext`);
  return decrypt(value);
}
