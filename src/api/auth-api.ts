import type { Credentials } from '@auth/accounts';
import { ApiError, HttpClient } from '@api/http-client';
import { AuthToken, Empty, TokenCheck, type TokenInfo } from '@api/schemas';

/**
 * /signup, /login, /check — the calls that create users and session tokens.
 * Passwords go out base64-encoded (UTF-8), exactly like the site's own forms.
 */
export class AuthApi extends HttpClient {
  async signup({ username, password }: Credentials): Promise<void> {
    await this.post('/signup', { username, password: toBase64(password) }, Empty);
  }

  /** Logs in and returns the session token. */
  async login({ username, password }: Credentials): Promise<string> {
    return this.post('/login', { username, password: toBase64(password) }, AuthToken);
  }

  /** Who a token belongs to and when it expires. */
  async check(token: string): Promise<TokenInfo> {
    return (await this.post('/check', { token }, TokenCheck)).Item;
  }

  /** Whether the server still accepts a token. */
  async isValid(token: string): Promise<boolean> {
    try {
      await this.check(token);
      return true;
    } catch (error) {
      if (error instanceof ApiError) return false;
      throw error;
    }
  }
}

/**
 * /check reports `expiration` as floor(epochSeconds / 1000) — observed
 * 1792237 at epoch 1791637503, i.e. 600 units (~6.9 days) after login.
 */
export function expiryToEpochSeconds(expiration: number): number {
  return expiration * 1000;
}

function toBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}
