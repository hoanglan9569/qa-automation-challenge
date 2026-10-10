import { check } from 'k6';
import type { Catalog, Product } from '@api/schemas';
import { json, type Api } from '@k6/lib/api';
import type { FlowData } from '@perf/plan';

/** A guest opening the home page (/entries) and then one product (/view). */
export function catalog(api: Api, { productIds }: FlowData['catalog']): void {
  const home = api.entries();
  check(home, {
    'catalog lists products': (r) => r.status === 200 && (json<Catalog>(r)?.Items.length ?? 0) > 0,
  });

  // Random, not __ITER-based: __ITER does not exist in setup(), where the warm-up runs.
  const productId = productIds[Math.floor(Math.random() * productIds.length)] ?? 1;
  const product = api.view(productId);
  check(product, {
    'product has a title and a price': (r) => {
      const body = json<Product>(r);
      return r.status === 200 && body?.id === productId && body.title !== '' && body.price > 0;
    },
  });
}
