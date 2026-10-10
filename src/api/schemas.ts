/**
 * DemoBlaze API responses as ArkType schemas. Each one validates a response
 * and is the source of its TypeScript type (`typeof X.infer`).
 *
 * k6 imports these with `import type` only, so ArkType stays out of k6.
 */

import { type } from 'arktype';

/** A business error: DemoBlaze's only error shape, checked before any schema. */
export const ErrorBody = type({ errorMessage: 'string' });

export const Product = type({
  id: 'number.integer > 0',
  title: 'string > 0',
  price: 'number > 0',
  cat: "'phone' | 'notebook' | 'monitor'",
  desc: 'string',
  img: 'string',
});
export type Product = typeof Product.infer;

/** /entries: one page of 9, `LastEvaluatedKey` pointing at the next. */
export const Catalog = type({ Items: Product.array(), 'LastEvaluatedKey?': { id: 'string' } });
export type Catalog = typeof Catalog.infer;

export const CartItem = type({
  /** Cart line id, used to delete the line. */
  id: 'string > 0',
  /** Cart key: the username when logged in, the guest cookie otherwise. */
  cookie: 'string',
  prod_id: 'number.integer > 0',
});
export type CartItem = typeof CartItem.infer;

export const Cart = type({ Items: CartItem.array() });
export type Cart = typeof Cart.infer;

export const TOKEN_PREFIX = 'Auth_token: ';

/** /login: a JSON string `"Auth_token: <token>"`, parsed to the bare token. */
export const AuthToken = type(/^Auth_token: \S+$/).pipe((body) => body.slice(TOKEN_PREFIX.length));

export const TokenInfo = type({
  username: 'string > 0',
  token: 'string > 0',
  /** Expiry in units of 1000 seconds since the epoch — see expiryToEpochSeconds. */
  expiration: 'number.integer > 0',
});
export type TokenInfo = typeof TokenInfo.infer;

/** /check */
export const TokenCheck = type({ Item: TokenInfo });
export type TokenCheck = typeof TokenCheck.infer;

/** /signup answers `""`, /addtocart an empty body. */
export const Empty = type("'' | null");

/** /deleteitem and /deletecart. */
export const ItemDeleted = type.unit('Item deleted.');
