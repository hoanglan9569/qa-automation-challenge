import { Account, ApiError, credentials, DateFormat, expect, formatDate, newUser, now, test } from '@fixtures';

test.describe('auth api', { tag: '@regression' }, () => {
  test('login returns a token that /check accepts', { tag: '@smoke' }, async ({ api }) => {
    const user = credentials(Account.ADMIN);

    const token = await test.step('log in with valid credentials', () => api.auth.login(user));

    await test.step('/check accepts the token for the same user', async () => {
      expect(await api.auth.check(token), '/check returns the user and token').toMatchObject({
        username: user.username,
        token,
      });
    });
  });

  test('login is refused with a wrong password', async ({ api }) => {
    const { username } = credentials(Account.ADMIN);

    await test.step('log in with a wrong password', async () => {
      await expect(api.auth.login({ username, password: 'wrong-password' }), 'login is refused').rejects.toThrow(
        'Wrong password.',
      );
    });
  });

  test('login is refused for a user that does not exist', async ({ api }) => {
    const username = `no-such-user-${formatDate(now(), DateFormat.STAMP)}`;

    await test.step('log in as an unknown user', async () => {
      await expect(api.auth.login({ username, password: 'whatever' }), 'login is refused').rejects.toThrow(
        'User does not exist.',
      );
    });
  });

  test('signing up a username that already exists is refused', async ({ api }) => {
    const user = await test.step('sign up a throwaway user', () => newUser());

    await test.step('sign up the same username again', async () => {
      await expect(
        api.auth.signup({ username: user.username, password: user.password }),
        'the second signup is refused',
      ).rejects.toThrow('This user already exist.');
    });
  });

  test('a token that was never issued is rejected', async ({ api }) => {
    await test.step('/check refuses a malformed token', async () => {
      await expect(api.auth.check('not-a-real-token'), '/check is refused').rejects.toThrow(
        'Bad parameter, token malformed.',
      );
    });

    await test.step('isValid reports it as not valid, without throwing', async () => {
      expect(await api.auth.isValid('not-a-real-token'), 'isValid of a malformed token').toBe(false);
    });
  });
});

// Empty input crashes the server instead of being refused. Marked test.fail()
// like the UI defects: they pass while the bug is present and turn red once fixed.
test.describe('auth api known defects', { tag: '@regression' }, () => {
  test(
    'login with empty fields is refused with an error message',
    { annotation: { type: 'issue', description: 'POST /login with an empty username and password answers HTTP 500' } },
    async ({ api }) => {
      test.fail();
      await expect(api.auth.login({ username: '', password: '' }), 'refused like any other bad login').rejects.toThrow(
        ApiError,
      );
    },
  );

  test(
    'an empty token is refused with an error message',
    { annotation: { type: 'issue', description: 'POST /check with an empty token answers HTTP 500' } },
    async ({ api }) => {
      test.fail();
      await expect(api.auth.check(''), 'refused like a malformed token').rejects.toThrow(ApiError);
    },
  );
});
