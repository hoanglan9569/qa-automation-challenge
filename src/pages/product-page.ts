import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base-page';
import { acceptAlert } from '@utils/dialogs';

export class ProductPage extends BasePage {
  protected readonly path = '/prod.html';
  readonly name: Locator;
  /** "$360 *includes tax" */
  readonly price: Locator;
  readonly addToCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.locator('#tbodyid h2.name');
    this.price = page.locator('#tbodyid h3.price-container');
    this.addToCartButton = page.getByRole('link', { name: 'Add to cart' });
  }

  async open(productId: number): Promise<void> {
    await this.page.goto(`${this.path}?idp_=${productId}`);
  }

  /**
   * Click "Add to cart" and return the alert the site confirms with once the
   * API call has landed: "Product added." logged in, "Product added" as guest.
   */
  async addToCart(): Promise<string> {
    return acceptAlert(this.page, () => this.addToCartButton.click());
  }
}
