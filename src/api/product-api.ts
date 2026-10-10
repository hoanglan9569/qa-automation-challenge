import { HttpClient } from '@api/http-client';
import { Catalog, Product } from '@api/schemas';

/** /entries, /view — the public catalog; no identity needed. */
export class ProductApi extends HttpClient {
  /** First page of the catalog (the API pages by 9). */
  async list(): Promise<Product[]> {
    return (await this.get('/entries', Catalog)).Items;
  }

  async byId(id: number): Promise<Product> {
    return this.post('/view', { id }, Product);
  }

  async byIds(ids: readonly number[]): Promise<Product[]> {
    return Promise.all(ids.map((id) => this.byId(id)));
  }
}
