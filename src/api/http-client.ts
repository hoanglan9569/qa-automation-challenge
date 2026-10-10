import type { APIRequestContext, APIResponse } from '@playwright/test';
import { type, type ArkErrors } from 'arktype';
import { env } from '@config/env';
import { ErrorBody } from '@api/schemas';

/** An ArkType type whose (possibly parsed) output is `T`. */
export type Schema<T> = (data: unknown) => T | ArkErrors;

/** DemoBlaze refused the call: it answers HTTP 200 + `{ errorMessage }`. */
export class ApiError extends Error {
  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`${path}: ${reason}`);
  }
}

/**
 * Unauthenticated JSON calls against API_URL. Each call returns its validated
 * data, and throws `ApiError` when the API refuses it, or `Error` on a
 * non-2xx status or a response that breaks its schema.
 */
export class HttpClient {
  constructor(protected readonly request: APIRequestContext) {}

  protected async get<T>(path: string, schema: Schema<T>): Promise<T> {
    return this.parse(path, await this.request.get(new URL(path, env.apiUrl).toString()), schema);
  }

  protected async post<T>(path: string, data: unknown, schema: Schema<T>): Promise<T> {
    return this.parse(path, await this.request.post(new URL(path, env.apiUrl).toString(), { data }), schema);
  }

  private async parse<T>(path: string, response: APIResponse, schema: Schema<T>): Promise<T> {
    const text = await response.text();
    if (!response.ok()) throw new Error(`${path} -> ${response.status()}: ${text.slice(0, 200)}`);

    const body: unknown = text.trim() === '' ? null : JSON.parse(text);
    if (ErrorBody.allows(body)) throw new ApiError(path, body.errorMessage);

    const data = schema(body);
    if (data instanceof type.errors)
      throw new Error(`${path}: response breaks its contract: ${data.summary}\n${text.slice(0, 200)}`);
    return data;
  }
}
