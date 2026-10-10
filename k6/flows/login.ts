import { check } from 'k6';
import type { TokenCheck } from '@api/schemas';
import { json, type Api } from '@k6/lib/api';
import type { FlowData } from '@perf/plan';

const TOKEN_PREFIX = 'Auth_token: ';

/** Log in (/login), then load the session like every page does (/check). */
export function login(api: Api, { username, password }: FlowData['login']): void {
  const response = api.login(username, password);
  const body = json<string>(response);
  const token = typeof body === 'string' && body.startsWith(TOKEN_PREFIX) ? body.slice(TOKEN_PREFIX.length) : '';
  check(response, { 'login returns a session token': (r) => r.status === 200 && token !== '' });
  if (token === '') return;

  const session = api.check(token);
  check(session, {
    'the token belongs to the user': (r) => json<TokenCheck>(r)?.Item.username === username,
  });
}
