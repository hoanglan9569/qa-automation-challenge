import { expect, test } from '@fixtures';

test('catalog: a guest opens the home page and a product', { tag: ['@perf', '@catalog'] }, async ({ api, k6 }) => {
  const productIds = await test.step('collect product ids from the catalog', async () => {
    const ids = (await api.products.list()).map((product) => product.id);
    expect(ids.length, 'the catalog has products to browse').toBeGreaterThan(0);
    return ids;
  });

  const result = await test.step('run the catalog flow in k6', () => k6.run('catalog', { productIds }));

  await test.step('stays within the SLOs', () => {
    expect(result.iterations, 'k6 completed iterations').toBeGreaterThan(0);
    expect(result.breaches(), 'SLO breaches: median and p95 ceiling per metric, error rate, check rate').toEqual([]);
  });
});
