import { check } from 'k6';
import type { Cart, ItemDeleted } from '@api/schemas';
import { json, lineId, type Api } from '@k6/lib/api';
import type { FlowData } from '@perf/plan';

/**
 * Add a line, find it in the cart, delete that same line. Each iteration only
 * touches its own line id, so concurrent VUs on one user stay independent,
 * and the cart-wide /deletecart is never called.
 */
export function cartWrite(api: Api, { token, productId }: FlowData['cart-write']): void {
  const id = lineId();

  const added = api.addToCart(token, id, productId);
  check(added, { 'line is added': (r) => r.status === 200 });

  const cart = api.viewCart(token);
  check(cart, {
    'cart contains the new line': (r) => (json<Cart>(r)?.Items ?? []).some((item) => item.id === id),
  });

  const deleted = api.deleteItem(id);
  check(deleted, {
    'line is deleted': (r) => r.status === 200 && json<typeof ItemDeleted.infer>(r) === 'Item deleted.',
  });
}
