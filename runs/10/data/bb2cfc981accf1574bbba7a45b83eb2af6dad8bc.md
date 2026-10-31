# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf/login.spec.ts >> login: /login then /check under load
- Location: tests/perf/login.spec.ts:3:0

# Error details

```
Error: SLO breaches: median and p95 ceiling per metric, error rate, check rate

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "login: p95 2081 ms, ceiling 2000 ms",
+ ]
```

# Test source

```ts
  1  | import { expect, newUser, test } from '@fixtures';
  2  | 
  3  | test('login: /login then /check under load', { tag: ['@perf', '@login'] }, async ({ k6 }) => {
  4  |   // A throwaway user, so no real credentials ever reach k6.
  5  |   const user = await test.step('sign up a throwaway user', () => newUser());
  6  | 
  7  |   const result = await test.step('run the login flow in k6', () =>
  8  |     k6.run('login', { username: user.username, password: user.password }));
  9  | 
  10 |   await test.step('stays within the SLOs', () => {
  11 |     expect(result.iterations, 'k6 completed iterations').toBeGreaterThan(0);
> 12 |     expect(result.breaches(), 'SLO breaches: median and p95 ceiling per metric, error rate, check rate').toEqual([]);
     |                                                                                                         ^ Error: SLO breaches: median and p95 ceiling per metric, error rate, check rate
  13 |   });
  14 | });
  15 | 
```