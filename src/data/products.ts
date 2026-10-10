import { faker } from '@faker-js/faker';

/**
 * Catalog ids used by tests. Titles and prices are not duplicated here: tests
 * read them from the API (`api.products.byId`) so they cannot drift.
 */
export const ProductId = {
  SAMSUNG_GALAXY_S6: 1,
  NOKIA_LUMIA_1520: 2,
  SONY_VAIO_I5: 8,
} as const;
export type ProductId = (typeof ProductId)[keyof typeof ProductId];

/** `count` ids picked at random from {@link ProductId}, repeats allowed. */
export function randomProductIds(count: number): ProductId[] {
  return Array.from({ length: count }, () => faker.helpers.arrayElement(Object.values(ProductId)));
}
