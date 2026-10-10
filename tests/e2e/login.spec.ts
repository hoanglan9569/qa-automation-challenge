import { Account, authState, credentials, DateFormat, expect, formatDate, now, test } from '@fixtures';

const EMPTY_FIELDS_ALERT = 'Please fill out Username and Password.';

test.describe('login', { tag: '@regression' }, () => {
  test('logs in with valid credentials through the UI', { tag: '@smoke' }, async ({ homePage }) => {
    const user = credentials(Account.ADMIN);

    await test.step('open the home page logged out', async () => {
      await homePage.goto();
      await expect(homePage.navbar.welcome, 'no welcome text before logging in').toBeHidden();
    });

    await test.step('open the login modal', async () => {
      await homePage.navbar.openLogin();
      await expect(homePage.loginModal.root, 'login modal opens').toBeVisible();
    });

    await test.step('submit valid credentials', async () => {
      await homePage.loginModal.login(user);
    });

    await test.step('the navbar shows the logged-in state', async () => {
      await expect(homePage.navbar.welcome).toHaveText(`Welcome ${user.username}`);
      await expect(homePage.navbar.logout, 'Log out link is shown').toBeVisible();
      await expect(homePage.navbar.login, 'Log in link is hidden').toBeHidden();
      await expect(homePage.navbar.signup, 'Sign up link is hidden').toBeHidden();
    });
  });

  // Negative paths: the site rejects each with a native alert and does not log in.
  for (const [label, user, alert] of [
    [
      'a wrong password',
      { username: credentials(Account.ADMIN).username, password: 'wrong-password' },
      'Wrong password.',
    ],
    [
      'an unknown user',
      { username: `no-such-user-${formatDate(now(), DateFormat.STAMP)}`, password: 'whatever' },
      'User does not exist.',
    ],
    ['empty fields', { username: '', password: '' }, EMPTY_FIELDS_ALERT],
  ] as const) {
    test(`is refused with ${label}`, async ({ homePage }) => {
      await test.step('open the login modal', async () => {
        await homePage.goto();
        await homePage.navbar.openLogin();
        await expect(homePage.loginModal.root).toBeVisible();
      });

      await test.step('submitting shows the alert and does not log in', async () => {
        expect(await homePage.loginModal.loginExpectingAlert(user), 'login alert').toBe(alert);
        await expect(homePage.loginModal.root, 'login modal stays open').toBeVisible();
        await expect(homePage.navbar.welcome, 'still logged out').toBeHidden();
      });
    });
  }
});

test.describe('logout', { tag: '@regression' }, () => {
  test.use({ account: Account.ADMIN });

  test('logs out and returns to the logged-out navbar', async ({ homePage }) => {
    await test.step('open the home page logged in', async () => {
      await homePage.goto();
      await expect(homePage.navbar.welcome).toHaveText(`Welcome ${credentials(Account.ADMIN).username}`);
    });

    await test.step('click Log out', async () => {
      await homePage.navbar.signOut();
    });

    await test.step('the navbar is back to the logged-out state', async () => {
      await expect(homePage.navbar.login, 'Log in link is shown again').toBeVisible();
      await expect(homePage.navbar.welcome, 'welcome text is gone').toBeHidden();
    });
  });
});

test.describe('saved session via the account option', { tag: '@regression' }, () => {
  test.use({ account: Account.ADMIN });

  test('opens already logged in', async ({ homePage }) => {
    await test.step('open the home page with the saved session', async () => {
      await homePage.goto();
    });

    await test.step('the navbar shows the logged-in state', async () => {
      await expect(homePage.navbar.welcome).toHaveText(`Welcome ${credentials(Account.ADMIN).username}`);
      await expect(homePage.navbar.login, 'Log in link is hidden').toBeHidden();
    });
  });
});

test.describe('saved session via storageState', { tag: '@regression' }, () => {
  test.use({ storageState: async ({}, use) => use(await authState(Account.ADMIN)) });

  test('opens already logged in', async ({ homePage }) => {
    await test.step('open the home page with the saved session', async () => {
      await homePage.goto();
    });

    await test.step('the navbar shows the logged-in state', async () => {
      await expect(homePage.navbar.welcome).toHaveText(`Welcome ${credentials(Account.ADMIN).username}`);
    });
  });
});
