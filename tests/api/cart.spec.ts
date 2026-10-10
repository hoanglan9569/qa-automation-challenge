import { Account, expect, newUser, ProductId, test, type Session } from '@fixtures';

test.describe('cart api', { tag: '@regression' }, () => {
  test.use({ account: Account.NEW_USER });

  test('adds lines, deletes one, then clears the cart', async ({ api, user }) => {
    const cart = api.as(user).cart;

    const [first, second] = await test.step('add two products', async () => {
      const added = [await cart.add(ProductId.SAMSUNG_GALAXY_S6), await cart.add(ProductId.NOKIA_LUMIA_1520)] as const;
      const lines = await cart.items();
      expect(lines.map((line) => line.id).sort(), 'both lines are in the cart').toEqual([...added].sort());
      return added;
    });

    await test.step('delete the first line', async () => {
      await cart.remove(first);
      expect(await cart.items(), 'only the second line is left').toEqual([
        { id: second, prod_id: ProductId.NOKIA_LUMIA_1520, cookie: user.username },
      ]);
    });

    await test.step('clear the cart', async () => {
      await cart.clear();
      expect(await cart.items(), 'cart is empty after /deletecart').toHaveLength(0);
    });
  });

  // Two real, separate accounts — not a guest, whose id is new on every client
  // and would make this pass without proving anything.
  test("one user never sees another user's cart", async ({ api, user }) => {
    const other = await test.step('sign up a second user', () => newUser());

    await test.step('each user adds a different product', async () => {
      await api.cart.add(ProductId.SAMSUNG_GALAXY_S6, { as: user });
      await api.cart.add(ProductId.NOKIA_LUMIA_1520, { as: other });
    });

    await test.step('each cart holds only its own line', async () => {
      const [mine, theirs] = await Promise.all([api.cart.items({ as: user }), api.cart.items({ as: other })]);
      expect(
        mine.map((line) => line.prod_id),
        "the first user's cart",
      ).toEqual([ProductId.SAMSUNG_GALAXY_S6]);
      expect(
        theirs.map((line) => line.prod_id),
        "the second user's cart",
      ).toEqual([ProductId.NOKIA_LUMIA_1520]);
    });
  });

  test('the cart is not readable with a token that was never issued', async ({ api }) => {
    const forged: Session = {
      account: Account.NEW_USER,
      username: 'nobody',
      token: 'not-a-real-token',
      expiresAt: 0,
    };

    await test.step('/viewcart refuses the forged token', async () => {
      await expect(api.cart.items({ as: forged }), '/viewcart is refused').rejects.toThrow(
        'Bad parameter, token malformed.',
      );
    });
  });
});

test.describe('product api', { tag: '@regression' }, () => {
  test('the catalog page and /view agree on a product', async ({ api }) => {
    const listed = await test.step('find the product in the catalog', async () => {
      const product = (await api.products.list()).find((item) => item.id === ProductId.SAMSUNG_GALAXY_S6);
      expect(product, `product ${ProductId.SAMSUNG_GALAXY_S6} is on the first catalog page`).toBeDefined();
      return product;
    });

    await test.step('/view returns the same title and price', async () => {
      expect(await api.products.byId(ProductId.SAMSUNG_GALAXY_S6), '/view matches the catalog entry').toMatchObject({
        title: listed?.title,
        price: listed?.price,
      });
    });
  });
});
