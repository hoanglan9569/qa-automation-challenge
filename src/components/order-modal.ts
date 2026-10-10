import { expect, type Locator, type Page } from '@playwright/test';
import type { OrderDetails } from '@data/orders';
import { acceptAlert, failOnDialog } from '@utils/dialogs';

/** "Place order" modal on the cart page. Only name and card are required by the site. */
export class OrderModal {
  readonly root: Locator;
  /** "Total: 360" */
  readonly total: Locator;
  readonly name: Locator;
  readonly country: Locator;
  readonly city: Locator;
  readonly card: Locator;
  readonly month: Locator;
  readonly year: Locator;
  readonly purchaseButton: Locator;
  readonly close: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#orderModal');
    this.total = this.root.locator('#totalm');
    this.name = this.root.locator('#name');
    this.country = this.root.locator('#country');
    this.city = this.root.locator('#city');
    this.card = this.root.locator('#card');
    this.month = this.root.locator('#month');
    this.year = this.root.locator('#year');
    this.purchaseButton = this.root.getByRole('button', { name: 'Purchase' });
    this.close = this.root.getByRole('button', { name: 'Close' }).last();
  }

  async fill(order: Partial<OrderDetails>): Promise<void> {
    // Bootstrap focuses the modal when its fade-in ends; typing before then
    // drops characters (seen on WebKit). Wait for the modal to settle, then
    // verify each value stuck instead of filling blind.
    await expect(this.root, 'order modal is ready for input').toBeFocused();
    for (const field of ['name', 'country', 'city', 'card', 'month', 'year'] as const) {
      const value = order[field];
      if (value === undefined) continue;
      await this[field].fill(value);
      await expect(this[field], `${field} keeps the value it was given`).toHaveValue(value);
    }
  }

  /**
   * Click Purchase and wait until the site has emptied the cart. It fires that
   * request without awaiting it, and leaving the page first can cancel it. A
   * validation alert (missing field) fails fast instead of timing out.
   */
  async purchase(): Promise<void> {
    await this.waitForCartKey();
    const guard = failOnDialog(this.page, 'purchase');
    try {
      await Promise.race([
        Promise.all([this.page.waitForResponse(/\/deletecart$/), this.purchaseButton.click()]),
        guard.rejected,
      ]);
    } finally {
      guard.dispose();
    }
  }

  /**
   * Site defect guard: Purchase sends /deletecart with the cart key, and an
   * empty key empties EVERY user's cart. Wait for the key; refuse if empty.
   */
  private async waitForCartKey(): Promise<void> {
    const key = await this.page
      .waitForFunction(() => {
        const loggedIn = document.cookie.split(/;\s*/).some((cookie) => cookie.startsWith('tokenp_='));
        if (!loggedIn) return { key: document.cookie };
        const username = (window as Window & { usern?: string }).usern;
        return username ? { key: username } : false;
      })
      .then(async (handle) => (await handle.jsonValue()) as { key: string });
    if (key.key === '') {
      throw new Error(
        'refusing to purchase: the cart key is empty, and /deletecart("") would empty every cart on the site',
      );
    }
  }

  /** Click Purchase and return the validation alert the site shows instead of ordering. */
  async purchaseExpectingAlert(): Promise<string> {
    return acceptAlert(this.page, () => this.purchaseButton.click());
  }
}
