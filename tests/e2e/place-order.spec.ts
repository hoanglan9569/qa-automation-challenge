import { Account, DateFormat, expect, formatDate, now, orderDetails, ProductId, test } from '@fixtures';

const MISSING_FIELDS_ALERT = 'Please fill out Name and Creditcard.';

// Every test gets its own freshly signed-up user: the cart lives server-side
// per user and a purchase empties it, so a shared account would race.
test.describe('add to cart and place an order', { tag: '@regression' }, () => {
  test.use({ account: Account.NEW_USER });

  test(
    'buys a product picked from the catalog',
    { tag: '@smoke' },
    async ({ page, homePage, productPage, cartPage, api, user }) => {
      const product = await api.products.byId(ProductId.SAMSUNG_GALAXY_S6);
      const order = orderDetails();

      await test.step('open the home page logged in', async () => {
        await homePage.goto();
        await expect(homePage.navbar.welcome).toHaveText(`Welcome ${user.username}`);
      });

      await test.step(`open "${product.title}" from the catalog`, async () => {
        await homePage.openProduct(product.title);
        await expect(productPage.name).toHaveText(product.title);
        await expect(productPage.price).toContainText(`$${product.price}`);
      });

      await test.step('add it to the cart', async () => {
        expect(await productPage.addToCart(), 'add-to-cart confirmation alert').toBe('Product added.');
      });

      await test.step('the cart lists the product and its price as the total', async () => {
        await productPage.navbar.openCart();
        await expect(cartPage.rows, 'one line in the cart').toHaveCount(1);
        expect(await cartPage.items(), 'cart line matches the product').toEqual([
          { title: product.title, price: product.price },
        ]);
        await expect(cartPage.total).toHaveText(String(product.price));
      });

      await test.step('place the order', async () => {
        await cartPage.openPlaceOrder();
        await expect(cartPage.orderModal.total).toHaveText(`Total: ${product.price}`);
        await cartPage.orderModal.fill(order);
        await cartPage.orderModal.purchase();
      });

      await test.step('the receipt matches the order', async () => {
        await expect(cartPage.confirmation.title).toHaveText('Thank you for your purchase!');
        const receipt = await cartPage.confirmation.receipt();
        expect(receipt, 'receipt amount, card and name').toMatchObject({
          amount: product.price,
          card: order.card,
          name: order.name,
        });
        expect(receipt.id, 'receipt has an order id').toBeGreaterThan(0);
      });

      await test.step('confirming returns home with an empty cart', async () => {
        await cartPage.confirmation.confirm();
        await expect(page, 'redirected to the home page').toHaveURL(/\/index\.html$/);
        await expect
          .poll(() => api.cart.items({ as: user }), { message: 'cart is emptied after the purchase' })
          .toHaveLength(0);
      });
    },
  );

  test('orders several products, one of them twice, for their summed total', async ({ cartPage, api, user }) => {
    const ids = [ProductId.SAMSUNG_GALAXY_S6, ProductId.SAMSUNG_GALAXY_S6, ProductId.NOKIA_LUMIA_1520];
    const products = await api.products.byIds(ids);
    const total = products.reduce((sum, product) => sum + product.price, 0);

    await test.step('seed the cart over the API', async () => {
      await api.cart.seed(ids, { as: user });
    });

    await test.step('the cart lists every line and sums the total', async () => {
      await cartPage.goto();
      await expect(cartPage.rows, `${ids.length} lines in the cart`).toHaveCount(ids.length);
      await expect(cartPage.total).toHaveText(String(total));
      const titles = (await cartPage.items()).map((item) => item.title);
      expect(titles.sort(), 'cart lines match the seeded products').toEqual(
        products.map((product) => product.title).sort(),
      );
    });

    await test.step('place the order', async () => {
      await cartPage.openPlaceOrder();
      await expect(cartPage.orderModal.total).toHaveText(`Total: ${total}`);
      await cartPage.orderModal.fill(orderDetails());
      await cartPage.orderModal.purchase();
    });

    await test.step('the receipt charges the summed total', async () => {
      expect((await cartPage.confirmation.receipt()).amount, 'receipt amount is the sum of all lines').toBe(total);
    });
  });

  test('removing a line updates the cart and its total', async ({ cartPage, api, user }) => {
    const [kept, removed] = await Promise.all([
      api.products.byId(ProductId.SAMSUNG_GALAXY_S6),
      api.products.byId(ProductId.NOKIA_LUMIA_1520),
    ]);

    await test.step('seed two products over the API', async () => {
      await api.cart.seed([kept.id, removed.id], { as: user });
    });

    await test.step(`delete "${removed.title}" from the cart`, async () => {
      await cartPage.goto();
      await expect(cartPage.rows, 'both seeded lines are listed').toHaveCount(2);
      await cartPage.deleteItem(removed.title);
    });

    await test.step('only the kept product remains, in the UI and on the server', async () => {
      await expect(cartPage.rows, 'one line left').toHaveCount(1);
      await expect(cartPage.row(kept.title), `"${kept.title}" is still listed`).toBeVisible();
      await expect(cartPage.total).toHaveText(String(kept.price));
      const items = await api.cart.items({ as: user });
      expect(
        items.map((item) => item.prod_id),
        'server-side cart holds only the kept product',
      ).toEqual([kept.id]);
    });
  });

  for (const [missing, overrides] of [
    ['name', { name: '' }],
    ['credit card', { card: '' }],
    ['name and credit card', { name: '', card: '' }],
  ] as const) {
    test(`refuses to purchase without ${missing}`, async ({ cartPage, api, user }) => {
      await test.step('seed one product over the API', async () => {
        await api.cart.seed([ProductId.SAMSUNG_GALAXY_S6], { as: user });
      });

      await test.step(`fill the order form without ${missing}`, async () => {
        await cartPage.goto();
        await expect(cartPage.rows, 'the seeded line is listed').toHaveCount(1);
        await cartPage.openPlaceOrder();
        await cartPage.orderModal.fill(orderDetails(overrides));
      });

      await test.step('purchase is refused with an alert', async () => {
        expect(await cartPage.orderModal.purchaseExpectingAlert(), 'validation alert').toBe(MISSING_FIELDS_ALERT);
        await expect(cartPage.orderModal.root, 'order form stays open').toBeVisible();
        await expect(cartPage.confirmation.title, 'no purchase confirmation').toBeHidden();
      });

      await test.step('the cart is untouched', async () => {
        const items = await api.cart.items({ as: user });
        expect(items, 'server-side cart still holds the line').toHaveLength(1);
      });
    });
  }
});

test.describe('add to cart and place an order as a guest', { tag: '@regression' }, () => {
  test.use({ account: Account.GUEST });

  test('buys a product without logging in', async ({ homePage, productPage, cartPage, api }) => {
    const product = await api.products.byId(ProductId.SONY_VAIO_I5);

    // Start on the home page like a real visitor: only index.html sets the
    // `user` cookie a guest cart is keyed by.
    await test.step('open the home page logged out', async () => {
      await homePage.goto();
      await expect(homePage.navbar.login, 'Log in link is shown to a guest').toBeVisible();
    });

    await test.step(`add "${product.title}" to the cart`, async () => {
      await homePage.openProduct(product.title);
      await expect(productPage.name).toHaveText(product.title);
      expect(await productPage.addToCart(), 'guest add-to-cart alert (no trailing period)').toBe('Product added');
    });

    await test.step('the cart lists the product', async () => {
      await productPage.navbar.openCart();
      await expect(cartPage.rows, 'one line in the guest cart').toHaveCount(1);
      await expect(cartPage.total).toHaveText(String(product.price));
    });

    await test.step('place the order', async () => {
      await cartPage.openPlaceOrder();
      await cartPage.orderModal.fill(orderDetails());
      await cartPage.orderModal.purchase();
    });

    await test.step('the receipt charges the product price', async () => {
      expect((await cartPage.confirmation.receipt()).amount, 'receipt amount is the product price').toBe(product.price);
    });
  });
});

// Defects found while automating. Marked test.fail(): they pass while the bug
// is present and turn red once it is fixed, so the expectation gets updated.
test.describe('known defects', { tag: '@regression' }, () => {
  test.use({ account: Account.NEW_USER });

  test(
    "the receipt shows today's date",
    {
      annotation: {
        type: 'issue',
        description: 'Receipt date uses Date#getMonth(), which is 0-based: October shows as 9',
      },
    },
    async ({ cartPage, api, user }) => {
      await test.step('order one product', async () => {
        await api.cart.seed([ProductId.SAMSUNG_GALAXY_S6], { as: user });
        await cartPage.goto();
        await expect(cartPage.rows, 'the seeded line is listed').toHaveCount(1);
        await cartPage.openPlaceOrder();
        await cartPage.orderModal.fill(orderDetails());
        await cartPage.orderModal.purchase();
      });

      // Only the date assertion below is expected to fail: a broken setup above
      // still fails the test instead of being masked as "expected".
      test.fail();

      await test.step('the receipt is dated today', async () => {
        const receipt = await cartPage.confirmation.receipt();
        expect(receipt.date, 'receipt date, with a 1-based month').toBe(formatDate(now(), DateFormat.RECEIPT));
      });
    },
  );

  test(
    'an empty cart cannot be ordered',
    { annotation: { type: 'issue', description: 'Purchase succeeds with an empty cart and shows "Amount: 0 USD"' } },
    async ({ cartPage }) => {
      await test.step('try to order from an empty cart', async () => {
        await cartPage.goto();
        await expect(cartPage.rows, 'the cart is empty').toHaveCount(0);
        await cartPage.openPlaceOrder();
        await cartPage.orderModal.fill(orderDetails());
        await cartPage.orderModal.purchase();
      });

      // Only the assertion below is expected to fail — see the date defect above.
      test.fail();

      await test.step('no purchase is confirmed', async () => {
        await expect(cartPage.confirmation.title, 'no confirmation for an empty cart').toBeHidden();
      });
    },
  );
});
