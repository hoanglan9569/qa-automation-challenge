import { check } from 'k6';
import { Trend } from 'k6/metrics';
import type { Cart, Product } from '@api/schemas';
import { json, type Api } from '@k6/lib/api';
import type { FlowData } from '@perf/plan';
import { stopwatch } from '@utils/date';

/** Time to fill the cart page: /viewcart, then every line's /view in parallel. */
const cartPage = new Trend('cart_page', true);

/** What the cart page does on load, against a cart seeded with a known number of lines. */
export function viewCart(api: Api, { token, lines }: FlowData['view-cart']): void {
  const elapsed = stopwatch();

  const cart = api.viewCart(token);
  const items = json<Cart>(cart)?.Items ?? [];
  check(cart, { [`cart holds the ${lines} seeded lines`]: (r) => r.status === 200 && items.length === lines });

  const products = api.viewMany(items.map((item) => item.prod_id));
  check(products, {
    'every line resolves to a product': (responses) =>
      responses.every((r) => r.status === 200 && json<Product>(r)?.title),
  });

  if (api.measuring) cartPage.add(elapsed());
}
