import { expect, newUser, test } from '@fixtures';

test('login: /login then /check under load', { tag: ['@perf', '@login'] }, async ({ k6 }) => {
  // A throwaway user, so no real credentials ever reach k6.
  const user = await test.step('sign up a throwaway user', () => newUser());

  const result = await test.step('run the login flow in k6', () =>
    k6.run('login', { username: user.username, password: user.password }));

  await test.step('stays within the SLOs', () => {
    expect(result.iterations, 'k6 completed iterations').toBeGreaterThan(0);
    expect(result.breaches(), 'SLO breaches: median and p95 ceiling per metric, error rate, check rate').toEqual([]);
  });
});
