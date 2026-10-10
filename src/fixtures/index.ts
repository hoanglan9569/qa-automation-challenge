import { join } from 'node:path';
import { test as base } from '@playwright/test';
import { Api } from '@api';
import { Account } from '@auth/accounts';
import { newUser, session, storageState, type Session } from '@auth/session';
import { CartPage } from '@pages/cart-page';
import { HomePage } from '@pages/home-page';
import { ProductPage } from '@pages/product-page';
import { bundleK6, K6 } from '@perf/k6';
import { ensureK6 } from '@perf/k6-binary';

type Options = {
  /** Who the browser context is logged in as. Default GUEST (no session). */
  account: Account;
};

type Fixtures = {
  /**
   * The session the browser is logged in with — for NEW_USER, the user signed
   * up for this test (a NewUser, with its password). Throws for GUEST.
   * Pass it to the API helpers to act as the same user: `api.as(user)`.
   */
  user: Session;
  /** API helpers acting as Account.ADMIN; `api.as(...)` to switch. */
  api: Api;
  homePage: HomePage;
  productPage: ProductPage;
  cartPage: CartPage;
  /** Runs a k6 flow against data the test seeded: `await k6.run('view-cart', { … })`. */
  k6: K6;
};

type Internal = {
  /** Resolves `account` to a session once per test; shared by storageState and user. */
  _session: Session | undefined;
};

type WorkerFixtures = {
  /** The k6 binary (downloaded on first use) and k6/entry.ts bundled once per worker. */
  _k6Setup: { binary: string; bundle: string };
};

export const test = base.extend<Options & Fixtures & Internal, WorkerFixtures>({
  account: [Account.GUEST, { option: true }],

  _session: async ({ account }, use) => {
    if (account === Account.GUEST) return use(undefined);
    await use(account === Account.NEW_USER ? await newUser() : await session(account));
  },
  storageState: async ({ _session }, use) => use(storageState(_session)),
  user: async ({ _session }, use) => {
    if (_session === undefined) throw new Error('no user: the test runs as Account.GUEST — set test.use({ account })');
    await use(_session);
  },

  api: async ({ request }, use) => use(new Api(request)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),

  _k6Setup: [
    async ({}, use, workerInfo) => {
      const [binary, bundle] = await Promise.all([
        ensureK6(),
        bundleK6(join(workerInfo.project.outputDir, `.k6-bundle-${workerInfo.workerIndex}`)),
      ]);
      await use({ binary, bundle });
    },
    { scope: 'worker' },
  ],
  k6: async ({ _k6Setup }, use, testInfo) => use(new K6(_k6Setup.binary, _k6Setup.bundle, testInfo)),
});

export { expect } from '@playwright/test';
export { ApiError } from '@api';
export { Account, credentials } from '@auth/accounts';
export { authState, newUser, type NewUser, type Session } from '@auth/session';
export { orderDetails, type OrderDetails } from '@data/orders';
export { ProductId, randomProductIds } from '@data/products';
export { DateFormat, formatDate, now } from '@utils/date';
