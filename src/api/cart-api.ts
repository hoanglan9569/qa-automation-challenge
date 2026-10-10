import { randomUUID } from 'node:crypto';
import { ApiClient, type CallOptions } from '@api/api-client';
import { Cart, Empty, ItemDeleted, type CartItem } from '@api/schemas';

/** /addtocart, /viewcart, /deleteitem, /deletecart. */
export class CartApi extends ApiClient {
  /** The lines in the cart. */
  async items(options?: CallOptions): Promise<CartItem[]> {
    const { cookie, flag } = await this.caller(options);
    return (await this.post('/viewcart', { cookie, flag }, Cart)).Items;
  }

  /** Adds one unit of a product; returns the new line id. */
  async add(productId: number, options?: CallOptions): Promise<string> {
    const { cookie, flag } = await this.caller(options);
    const id = randomUUID();
    await this.post('/addtocart', { id, cookie, prod_id: productId, flag }, Empty);
    return id;
  }

  /** Puts these products in the cart, one line each; returns the line ids. */
  async seed(productIds: readonly number[], options?: CallOptions): Promise<string[]> {
    return Promise.all(productIds.map((id) => this.add(id, options)));
  }

  async remove(lineId: string): Promise<void> {
    await this.post('/deleteitem', { id: lineId }, ItemDeleted);
  }

  /**
   * Empties the whole cart — what the site does after a purchase. An empty key
   * would empty every user's cart on the site, so it is rejected here.
   */
  async clear(options?: CallOptions): Promise<void> {
    const { cartKey } = await this.caller(options);
    if (cartKey.trim() === '')
      throw new Error('refusing /deletecart with an empty key: it empties every cart on the site');
    await this.post('/deletecart', { cookie: cartKey }, ItemDeleted);
  }
}
