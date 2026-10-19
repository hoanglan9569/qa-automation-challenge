# qa-automation-challenge

[![Tests on push](https://img.shields.io/github/actions/workflow/status/hoanglan9569/qa-automation-challenge/ci.yml?branch=main&event=push&label=tests%20on%20push)](https://github.com/hoanglan9569/qa-automation-challenge/actions/workflows/ci.yml)
[![Nightly check of the live site](https://img.shields.io/github/actions/workflow/status/hoanglan9569/qa-automation-challenge/ci.yml?branch=main&event=schedule&label=nightly%20check%20of%20the%20live%20site)](#ci)
[![Test reports](https://img.shields.io/badge/test_reports-GitHub_Pages-2ea44f)](https://hoanglan9569.github.io/qa-automation-challenge/)

Test automation for [DemoBlaze](https://www.demoblaze.com/), built for the
[S5Tech QA Automation Challenge](https://s5tech.notion.site/QA-Automation-Challenge-1d748905ea7780038b4cc1c1eea6087c).

**Stack:** Bun · TypeScript 7 · Playwright Test · ArkType · Faker · date-fns · k6 · ESLint · Prettier

Covers login, add to cart and place an order — each through both the UI and the API — plus the
performance of the catalog, login and cart. Found along the way:
[5 site defects](#known-defects) and [5 performance findings](#performance-findings).

## Run

[Bun](https://bun.sh) 1.4+ is the only prerequisite. Browsers and k6 are downloaded into the repo
(`.tools/`, gitignored), so a clean Windows, macOS or Linux machine works.

```powershell
bun run setup                    # packages, then Chromium, Firefox, WebKit + the OS libraries they need
$env:STRING_HEX_DEMOBLAZE = 'cfc9080781f2d3a6aa6f0d31d50b415690cb141bef58546907fa525fa4499353'
bun run test:smoke               # the two demo flows: log in · add to cart, then place an order
```

On macOS/Linux, set the key with
`export STRING_HEX_DEMOBLAZE=cfc9080781f2d3a6aa6f0d31d50b415690cb141bef58546907fa525fa4499353`.
On Linux, `bun run setup` installs those libraries with apt, so it asks for sudo; on Windows and
macOS the browsers are self-contained.

> **About `STRING_HEX_DEMOBLAZE`:** everything sensitive in this repo (the demo account in `env/`)
> is committed encrypted, and this key decrypts it. It is included only because this is a demo, so
> anyone can run the suite — a real project would never write it down like this, but keep it in a
> CI secret.

| Command              | Runs                                              |
| -------------------- | ------------------------------------------------- |
| `bun run test:smoke` | The two demo flows + API login — fastest check    |
| `bun run test`       | Full functional suite, API + Chromium             |
| `bun run test:all`   | Same, plus Firefox, WebKit, Pixel 7 and iPhone 15 |
| `bun run perf`       | Performance cases, light load, one at a time      |
| `bun run report`     | Open the last HTML report                         |

Browsers open headed at 1280×720, so the run can be watched; on CI (or on Linux without a
display) they run headless. Headed Firefox records no video, since recording its window stalls
the run.

Also available: `test:regression`, `test:mobile`, `test:branded` (the Chrome and Edge already
installed on the machine), `test:production`, `perf:load`, `browsers` (reinstall them after a
Playwright upgrade), `typecheck`, `lint`, `format`. Extra Playwright flags go after `--`, e.g.
`bun run test -- --workers=2`.

**Platforms.** Windows, macOS and Linux, on x64 and arm64. The default matrix only uses browsers
Playwright downloads, so it is identical everywhere; branded Chrome and Edge are opt-in because
they rely on the machine's own builds. k6 is fetched per OS on first use and verified against the
release SHA-256.

## Where each requirement is covered

| Asked for                              | Where                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-browser / platform               | Chromium, Firefox, WebKit, Pixel 7, iPhone 15 — same on Windows, macOS, Linux; CI runs all three platforms                                          |
| CI/CD                                  | GitHub Actions on push, pull request, nightly and on demand — see [CI](#ci)                                                                         |
| Modular, scalable design               | `src/pages` + `src/components` (page objects), `src/api` (helpers), `src/fixtures` (wiring)                                                         |
| Configurable parameters                | `env/.env.<env>` + `TEST_ENV`, `PERF_PROFILE`, `.local` overrides, real env vars win; every timeout in `src/config/timeouts.ts`                     |
| Comprehensive reporting                | HTML report, trace + screenshot + video on failure, JUnit on CI, k6 summary attached to the test; every CI run publishes its report on GitHub Pages |
| UI tests                               | `tests/e2e/`                                                                                                                                        |
| API tests                              | `tests/api/`                                                                                                                                        |
| Regression                             | `@smoke` / `@regression` tags → `bun run test:smoke`, `bun run test:regression`                                                                     |
| Performance                            | `tests/perf/` — Playwright seeds the data, k6 generates the load                                                                                    |
| Demo: login + add to cart, place order | `tests/e2e/login.spec.ts`, `tests/e2e/place-order.spec.ts`                                                                                          |
| Test case documentation                | Submitted separately as a spreadsheet                                                                                                               |

## CI

[GitHub Actions](.github/workflows/ci.yml) runs the suite on every push to `main` and every pull request, nightly
against the live site, and on demand (Run workflow: environment, smoke or regression, load profile). The jobs run in
parallel and are merged into one HTML report per run, kept as a run artifact.

Every run on `main` also publishes its report to GitHub Pages, at `runs/<run number>/`: the run's page on GitHub links
to it, and [the index](https://hoanglan9569.github.io/qa-automation-challenge/) lists every run with its result and
logs ([latest](https://hoanglan9569.github.io/qa-automation-challenge/latest/)). The last 100 runs are kept, up to
500 MB, on the `gh-pages` branch.

The two status badges at the top split the runs by trigger. **Tests on push** follows the runs a push starts: the
code as it was checked, against the live site, when it last changed. **Nightly check of the live site** follows the
scheduled runs, which repeat the same suite with no code change, so it turns red when DemoBlaze itself breaks a
budget: see finding [P5](#performance-findings).

| Job                                | Runs                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| lint · types · format              | ESLint, `tsc`, Prettier                                                                      |
| `<project> · linux`                | api, chromium, firefox, webkit, mobile-chrome, mobile-safari, in the Playwright Docker image |
| chromium · windows, webkit · macos | The other desktop platforms (job containers are Linux-only), browser installed on the runner |
| performance (k6)                   | `bun run perf`                                                                               |

Failures also show as annotations on the run. The key is the `STRING_HEX_DEMOBLAZE` repository secret, and Bun is
pinned by `packageManager` in `package.json`. Other CIs (Jenkins, GitLab CI, …) run the same commands: with `CI` set,
the config runs headless with retries and writes `test-results/junit.xml`.

## Project structure

```
├─ .github/                CI: workflows/ci.yml, actions/setup (Bun, packages, a browser)
├─ env/                    .env.staging, .env.production (credentials encrypted)
├─ src/
│  ├─ config/              env loading + validation, paths, timeouts
│  ├─ utils/               crypto (encrypt/decrypt), date formats + time (date-fns), native-alert helpers
│  ├─ auth/                accounts, API login → storage state
│  ├─ api/                 API helpers + ArkType response schemas
│  ├─ components/          navbar, login modal, order modal, purchase confirmation
│  ├─ pages/               home, product, cart
│  ├─ data/                random order data (Faker), product ids
│  ├─ perf/                k6 runner, load profiles, SLO budgets
│  ├─ fixtures/            `test` with page objects, `api`, `user`, `k6`
│  └─ global-setup.ts      logs in the saved accounts once per run
├─ k6/                     k6 scripts: entry point, HTTP client, flows
├─ tests/                  api/ · e2e/ · perf/
├─ scripts/                crypto CLI, k6 installer, report history for GitHub Pages
├─ playwright.config.ts    projects: api, chromium, firefox, webkit, mobile, chrome/edge, perf
└─ eslint.config.ts        lint rules (Prettier in .prettierrc.json)
```

Generated and gitignored: `.auth/` (storage states), `.tools/` (browsers, k6), reports. TypeScript
appears twice in `package.json` on purpose — `typescript-7` is the compiler, `typescript` is TS 6
for ESLint, which cannot use the TS 7 API yet.

A spec asks for the fixtures it needs and nothing else:

```ts
test.use({ account: Account.NEW_USER });

test('view cart', { tag: ['@regression'] }, async ({ api, user, cartPage }) => {
  await api.cart.seed([ProductId.SAMSUNG_GALAXY_S6], { as: user });
  await cartPage.goto();
});
```

## Design decisions

- **Set up over the API, assert through the UI.** A cart is filled with one `api.cart.seed(...)`
  call instead of ten clicks, so a UI test fails for the reason it is named after. The UI is
  driven only through page objects.
- **A fresh user per cart test.** The cart lives server-side per user and a purchase empties it,
  so a shared account would make parallel tests fight over one cart. `Account.NEW_USER` signs up
  a throwaway user, which keeps `fullyParallel` safe.
- **Login over HTTP, not through the form.** The token is minted once and reused as a storage
  state, so the login form is not a dependency of unrelated tests. It still has its own tests,
  where it is the thing under test.
- **Responses are validated, not assumed.** Every response is parsed by an ArkType schema, which
  is also the source of the TypeScript types. A changed response fails at the call with the field
  named: `/viewcart: response breaks its contract: Items[0].prod_id must be a number (was a string)`.
- **Known defects are tests, not comments.** They run as `test.fail()`, so they pass while the bug
  exists and turn red the day it is fixed. `test.fail()` comes after the setup steps, so a broken
  selector in setup still fails the test instead of being masked.
- **Performance is a normal test.** `tests/perf` seeds data with the same API helpers, hands k6 a
  token, and asserts on the summary — so load tests reuse the framework instead of forming a
  second one.
- **The framework refuses to break the site.** DemoBlaze's `/deletecart` with an empty key wipes
  every user's cart (defect 3), so both the API helper and the order modal check the key first.

Three site quirks shaped the page objects: Bootstrap focuses a modal only once its fade-in ends, and
typing before that silently drops characters (it surfaced as flaky empty fields on WebKit), so
`fill` waits for focus and verifies each value stuck; the purchase confirmation ignores OK for its
first 500 ms — a click then closes it without going home (it surfaced on CI) — so `confirm` waits
for it to arm; and the site reports failures as native `alert()`s, so actions that expect a page
change fail fast with the alert's own message instead of timing out.

## Test coverage

| Spec              | Cases                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/login`       | Log in through the UI · refused with a wrong password, an unknown user, empty fields · log out · open already logged in from a saved session (two ways)                     |
| `e2e/place-order` | Buy one product: cart, total, receipt, cart emptied · several products, one twice · remove a line · purchase refused without name / card · guest purchase · 2 known defects |
| `api/auth`        | Login token accepted by `/check` · wrong password · unknown user · duplicate signup · a token that was never issued · empty fields / token (defect 5)                       |
| `api/cart`        | Add, view, delete, clear · one user never sees another's cart · cart refused with a forged token · catalog vs `/view`                                                       |
| `perf/catalog`    | Home page + one product, as a guest                                                                                                                                         |
| `perf/login`      | `/login` + `/check`                                                                                                                                                         |
| `perf/cart`       | Cart page with 1 and 10 lines · add, find, delete a line                                                                                                                    |

`@smoke` is the critical path (UI login, buy a product, API login) and is what the mobile projects
run; `@regression` is every functional test.

## Configuration and secrets

`TEST_ENV` (`staging` by default, or `production`) selects `env/.env.<TEST_ENV>`. A `.local` file
next to it, or a real environment variable, overrides a value, and bad or missing values fail at
startup.

Credentials are committed only as encrypted `enc1.…` tokens — AES-256-GCM with a per-token key
derived by HKDF-SHA256, unlocked by `STRING_HEX_DEMOBLAZE`. A wrong key or a modified token
throws rather than returning garbage, and plaintext in an env file is rejected. Manage tokens with
`bun run crypto keygen | encrypt | decrypt`, piping secrets in so they stay out of shell history.

## Performance

k6 receives only session tokens or throwaway accounts, never the real credentials. Each run
starts with an unmeasured warm-up, k6 checks response contents as well as timings (e.g. the cart
really holds the 10 seeded lines), and the summary is attached to the HTML report. Cases run one
at a time with no retries: parallel load skews timings, and a retry would hide a slow run.

| Profile           | Load                               |
| ----------------- | ---------------------------------- |
| `smoke` (default) | 2 iterations/s for 15 s            |
| `load`            | Ramp to 5 iterations/s, hold 1 min |

| Budget                                           | Fails the test?                   |
| ------------------------------------------------ | --------------------------------- |
| Median < 500 ms per endpoint (cart page < 1.5 s) | Yes                               |
| p95 < 2 s (cart page < 3.5 s)                    | Yes                               |
| Errors ≤ 1 %, checks ≥ 99 %                      | Yes                               |
| p95 < 800 ms (cart page < 1.5 s)                 | No, it adds a warning to the test |

The tighter p95 only warns: a smoke run has ~30 samples, so two slow calls decide its p95 and
gating on it would fail at random. The median is stable.

Adding a case: the same flow with new data is just a new test. A new flow needs a file in
`k6/flows/`, plus an entry in `src/perf/plan.ts` and in `k6/entry.ts`.

## Known defects

| #   | Defect                                                                                                                 | Severity | Test        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | The receipt date shows the previous month (0-based month)                                                              | Low      | `test.fail` |
| 2   | An empty cart can be ordered (`Amount: 0 USD`)                                                                         | Medium   | `test.fail` |
| 3   | `POST /deletecart` with an empty cookie empties **every user's cart** — the site sends it if Purchase is clicked early | Critical | Documented¹ |
| 4   | Guests who open a product or the cart page directly all share one cart                                                 | High     | Documented¹ |
| 5   | An empty username/password on `/login`, or an empty token on `/check`, crashes the API (HTTP 500)                      | Low      | `test.fail` |

`test.fail` tests pass while the bug exists and fail once it is fixed.
¹ Not run, because it would affect real users of this public site. The framework guards against #3
and avoids #4.

## Performance findings

From repeated smoke runs against production:

| #   | Finding                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Typical latency is fine: ~270–310 ms median per call, every response correct                                                                                                                                                                                                          |
| P2  | Occasional slow calls of 1–1.8 s, more of them under higher load (likely cold starts)                                                                                                                                                                                                 |
| P3  | The cart page slows as the cart grows: ~555 ms with 1 line, ~870 ms with 10. It makes one `/view` request per line                                                                                                                                                                    |
| P4  | Login p95 is 1.2–1.4 s, against an 800 ms target, while its median (~290 ms) is fine                                                                                                                                                                                                  |
| P5  | Nightly runs #9 to #11 (2026-10-17 to 19) broke the budgets: catalog median 1.16 s (budget 500 ms); p95 over the 2 s budget for login (2.08 s), the catalog (2.12 and 2.29 s) and `/viewcart` (2.14 and 2.15 s); cart page p95 4.43 s (budget 3.5 s). Only the performance job failed |

## License

[MIT](LICENSE) © Lan Hoang
