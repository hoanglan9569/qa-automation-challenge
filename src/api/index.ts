import type { APIRequestContext } from '@playwright/test';
import type { Identity } from '@api/api-client';
import { AuthApi } from '@api/auth-api';
import { CartApi } from '@api/cart-api';
import { ProductApi } from '@api/product-api';
import { Account } from '@auth/accounts';

/**
 * Every API helper behind one object, all acting as `identity` (default
 * Account.ADMIN). Switch for a block of calls with `api.as(Account.GUEST)` or
 * `api.as(user)`, or for one call with `{ as: … }`.
 */
export class Api {
  readonly auth: AuthApi;
  readonly cart: CartApi;
  readonly products: ProductApi;

  constructor(
    private readonly request: APIRequestContext,
    readonly identity: Identity = Account.ADMIN,
  ) {
    this.auth = new AuthApi(request);
    this.cart = new CartApi(request, identity);
    this.products = new ProductApi(request);
  }

  as(identity: Identity): Api {
    return new Api(this.request, identity);
  }
}

export { ApiError, type Schema } from '@api/http-client';
export type { CallOptions, Identity } from '@api/api-client';
export type { Cart, CartItem, Catalog, Product, TokenCheck, TokenInfo } from '@api/schemas';
