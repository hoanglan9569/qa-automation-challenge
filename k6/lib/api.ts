/**
 * Thin DemoBlaze client for k6 (k6/http). Every request is tagged with its
 * Endpoint name, which is what per-endpoint timings and SLOs key on.
 */

import { randomBytes } from 'k6/crypto';
import encoding from 'k6/encoding';
import http, { type RefinedResponse, type ResponseType } from 'k6/http';
import type { Endpoint } from '@perf/plan';

export type Response = RefinedResponse<ResponseType | undefined>;

const HEADERS = { 'Content-Type': 'application/json' };

/** Tag of warm-up requests: kept out of the per-endpoint timings the SLOs judge. */
export const WARMUP = 'warmup';

export class Api {
  /** @param measuring false for the warm-up: its requests are tagged `warmup`, not judged. */
  constructor(
    private readonly baseUrl: string,
    readonly measuring = true,
  ) {}

  entries(): Response {
    return http.get(`${this.baseUrl}/entries`, { tags: { name: this.tag('entries') } });
  }

  view(productId: number): Response {
    return this.post('view', '/view', { id: productId });
  }

  /** Several /view calls in parallel, like a browser filling the cart table. */
  viewMany(productIds: number[]): Response[] {
    return http.batch(
      productIds.map((id) => ({
        method: 'POST',
        url: `${this.baseUrl}/view`,
        body: JSON.stringify({ id }),
        params: { headers: HEADERS, tags: { name: this.tag('view') } },
      })),
    );
  }

  /** Password goes out base64-encoded, like the site's login form. */
  login(username: string, password: string): Response {
    return this.post('login', '/login', { username, password: encoding.b64encode(password) });
  }

  check(token: string): Response {
    return this.post('check', '/check', { token });
  }

  viewCart(token: string): Response {
    return this.post('viewcart', '/viewcart', { cookie: token, flag: true });
  }

  addToCart(token: string, lineId: string, productId: number): Response {
    return this.post('addtocart', '/addtocart', { id: lineId, cookie: token, prod_id: productId, flag: true });
  }

  /** Deletes one line by id. The cart-wide /deletecart is deliberately absent. */
  deleteItem(lineId: string): Response {
    return this.post('deleteitem', '/deleteitem', { id: lineId });
  }

  private post(name: Endpoint, path: string, body: unknown): Response {
    return http.post(`${this.baseUrl}${path}`, JSON.stringify(body), {
      headers: HEADERS,
      tags: { name: this.tag(name) },
    });
  }

  private tag(name: Endpoint): string {
    return this.measuring ? name : WARMUP;
  }
}

/** A random UUID-shaped id for a new cart line. */
export function lineId(): string {
  const hex = Array.from(new Uint8Array(randomBytes(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** JSON body of a response, or undefined when it is not JSON. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T types the parsed body for the caller
export function json<T>(response: Response): T | undefined {
  try {
    return response.json() as T;
  } catch {
    return undefined;
  }
}
