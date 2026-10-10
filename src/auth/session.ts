/**
 * API login → Playwright storage state in .auth/<env>/<account>.json.
 *
 * The token is stored as the site's `tokenp_` cookie, expiring when the server
 * says (fallback 8 h), and reused until 5 minutes before that.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { request } from '@playwright/test';
import { AuthApi, expiryToEpochSeconds } from '@api/auth-api';
import { ApiError } from '@api/http-client';
import { Account, credentials, type Credentials, type SavedAccount } from '@auth/accounts';
import { env } from '@config/env';
import { AUTH_DIR } from '@config/paths';
import { DateFormat, epochSeconds, formatDate, now, toSeconds } from '@utils/date';

export type StorageState = {
  cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }[];
  origins: [];
};

/** A logged-in identity: what the browser and the API helpers act as. */
export interface Session {
  account: Account;
  username: string;
  token: string;
  /** Epoch seconds. */
  expiresAt: number;
}

/** A throwaway user from {@link newUser}: its session plus the password it signed up with. */
export interface NewUser extends Session, Credentials {
  account: typeof Account.NEW_USER;
}

const TOKEN_COOKIE = 'tokenp_';
const FALLBACK_TTL_S = toSeconds({ hours: 8 });
const MAX_TTL_S = toSeconds({ days: 30 });
const SKEW_S = toSeconds({ minutes: 5 });

const pending = new Map<SavedAccount, Promise<Session>>();

/** Path of a saved account's storage state for the current TEST_ENV. */
export function statePath(account: Account): string {
  return join(AUTH_DIR, env.name, `${account}.json`);
}

/**
 * Storage-state path for an account, logging in over the API first when there
 * is no saved session or it is about to expire. GUEST gets an empty state;
 * NEW_USER signs up a fresh user on every call.
 *
 *   test.use({ storageState: async ({}, use) => use(await authState(Account.ADMIN)) });
 */
export async function authState(account: Account): Promise<string> {
  if (account === Account.GUEST) {
    const path = statePath(account);
    if (!existsSync(path)) writeState(path, storageState());
    return path;
  }
  if (account === Account.NEW_USER) {
    const user = await newUser();
    const path = join(AUTH_DIR, env.name, Account.NEW_USER, `${user.username}.json`);
    writeState(path, storageState(user));
    return path;
  }
  await session(account);
  return statePath(account);
}

/** The storage state of a session; no session gives an empty (logged-out) state. */
export function storageState(session?: Session): StorageState {
  if (session === undefined) return { cookies: [], origins: [] };
  return {
    cookies: [
      {
        name: TOKEN_COOKIE,
        value: session.token,
        domain: new URL(env.baseUrl).hostname,
        path: '/',
        expires: session.expiresAt,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };
}

/**
 * A live session for a saved account, from disk when still fresh, otherwise
 * from a new API login. `verify` also asks the server whether a saved token is
 * still accepted (global setup does this once per run). Deduplicated per process.
 */
export function session(account: SavedAccount, { verify = false } = {}): Promise<Session> {
  let current = pending.get(account);
  if (current === undefined) {
    current = resolveSession(account, verify).catch((error: unknown) => {
      pending.delete(account);
      throw error;
    });
    pending.set(account, current);
  }
  return current;
}

/** Sign up a unique throwaway user over the API and log it in. Nothing is cached. */
export async function newUser(): Promise<NewUser> {
  const user: Credentials = {
    username: `qa-${formatDate(now(), DateFormat.STAMP)}-${randomBytes(4).toString('hex')}`,
    password: randomBytes(18).toString('base64url'),
  };
  return withAuthApi(async (api) => {
    await api.signup(user);
    return { account: Account.NEW_USER, ...user, ...(await mintToken(api, user)) };
  });
}

async function resolveSession(account: SavedAccount, verify: boolean): Promise<Session> {
  const saved = readSession(account);
  if (saved !== undefined && saved.expiresAt - SKEW_S > epochSeconds()) {
    if (!verify || (await withAuthApi((api) => api.isValid(saved.token)))) return saved;
  }
  const { username } = credentials(account);
  const minted = await withAuthApi((api) => mintToken(api, credentials(account)));
  const fresh: Session = { account, username, ...minted };
  writeState(statePath(account), storageState(fresh));
  return fresh;
}

/** Log in, then ask /check for the token's expiry. */
async function mintToken(api: AuthApi, user: Credentials): Promise<{ token: string; expiresAt: number }> {
  const token = await api.login(user);
  try {
    return { token, expiresAt: sanitizeExpiry(expiryToEpochSeconds((await api.check(token)).expiration)) };
  } catch (error) {
    if (error instanceof ApiError) return { token, expiresAt: epochSeconds() + FALLBACK_TTL_S };
    throw error;
  }
}

function readSession(account: SavedAccount): Session | undefined {
  const path = statePath(account);
  if (!existsSync(path)) return undefined;
  try {
    const state = JSON.parse(readFileSync(path, 'utf8')) as StorageState;
    const cookie = state.cookies.find((c) => c.name === TOKEN_COOKIE);
    if (cookie === undefined) return undefined;
    return { account, username: credentials(account).username, token: cookie.value, expiresAt: cookie.expires };
  } catch {
    return undefined; // corrupt or half-written: log in again
  }
}

/** Atomic write, so a parallel reader never sees a partial file. */
function writeState(path: string, state: StorageState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

async function withAuthApi<T>(fn: (api: AuthApi) => Promise<T>): Promise<T> {
  const context = await request.newContext();
  try {
    return await fn(new AuthApi(context));
  } finally {
    await context.dispose();
  }
}

/** The server's expiry, unless it is already past or implausibly far out. */
function sanitizeExpiry(expiresAt: number): number {
  const ttl = expiresAt - epochSeconds();
  return ttl > SKEW_S && ttl <= MAX_TTL_S ? expiresAt : epochSeconds() + FALLBACK_TTL_S;
}
