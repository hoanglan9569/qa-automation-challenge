import { Account, expect, ProductId, randomProductIds, test } from '@fixtures';

// Each case runs as its own throwaway user, so its seeded cart is untouched
// by every other test and the k6 checks can expect exact contents.
test.describe('cart performance', () => {
  test.use({ account: Account.NEW_USER });

  // Same flow, different data: how the cart page scales with its size.
  for (const lines of [1, 10]) {
    test(`view cart: page load with ${lines} line(s)`, { tag: ['@perf', '@cart'] }, async ({ api, user, k6 }) => {
      await test.step(`seed ${lines} line(s) over the API`, async () => {
        await api.cart.seed(randomProductIds(lines), { as: user });
        expect(await api.cart.items({ as: user }), 'the cart holds exactly the seeded lines').toHaveLength(lines);
      });

      const result = await test.step('run the view-cart flow in k6', () =>
        k6.run('view-cart', { token: user.token, lines }));

      await test.step('stays within the SLOs', () => {
        expect(result.iterations, 'k6 completed iterations').toBeGreaterThan(0);
        expect(result.breaches(), 'SLO breaches: median and p95 ceiling per metric, error rate, check rate').toEqual(
          [],
        );
      });

      await test.step('clean up the cart', async () => {
        await api.cart.clear({ as: user });
      });
    });
  }

  test('cart write: add, find and delete a line', { tag: ['@perf', '@cart'] }, async ({ api, user, k6 }) => {
    const result = await test.step('run the cart-write flow in k6', () =>
      k6.run('cart-write', { token: user.token, productId: ProductId.SAMSUNG_GALAXY_S6 }));

    await test.step('stays within the SLOs', () => {
      expect(result.iterations, 'k6 completed iterations').toBeGreaterThan(0);
      expect(result.breaches(), 'SLO breaches: median and p95 ceiling per metric, error rate, check rate').toEqual([]);
    });

    await test.step('every line the flow added was deleted again', async () => {
      expect(await api.cart.items({ as: user }), 'no lines left behind by the flow').toHaveLength(0);
    });
  });
});
