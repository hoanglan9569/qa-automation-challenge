import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { HttpClient } from '@api/http-client';
import { Account } from '@auth/accounts';
import { session, type Session } from '@auth/session';

/** Who to act as: an account, or a concrete session (e.g. the `user` fixture). */
export type Identity = Account | Session;

/** Per-call override of the identity a client acts as. */
export interface CallOptions {
  as?: Identity;
}

/**
 * How DemoBlaze identifies the caller: endpoints take `cookie` + `flag` in the
 * body. A logged-in user sends its session token with flag=true; a guest sends
 * an anonymous id (the site's `user` cookie) with flag=false. Carts of
 * logged-in users are stored under their username.
 */
export interface Caller {
  cookie: string;
  flag: boolean;
  /** The key the cart is stored under: the username, or the guest id. */
  cartKey: string;
}

/** Base for endpoints that act as someone. Defaults to Account.ADMIN. */
export class ApiClient extends HttpClient {
  private readonly guestId = randomUUID();

  constructor(
    request: APIRequestContext,
    readonly identity: Identity = Account.ADMIN,
  ) {
    super(request);
  }

  protected async caller({ as = this.identity }: CallOptions = {}): Promise<Caller> {
    if (typeof as === 'object') return { cookie: as.token, flag: true, cartKey: as.username };
    if (as === Account.GUEST) return { cookie: this.guestId, flag: false, cartKey: this.guestId };
    if (as === Account.NEW_USER) {
      throw new Error('Account.NEW_USER is a different user every time: pass its Session (the `user` fixture) instead');
    }
    const { token, username } = await session(as);
    return { cookie: token, flag: true, cartKey: username };
  }
}
