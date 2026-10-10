import { expect, type Locator, type Page } from '@playwright/test';
import { LoginModal } from '@components/login-modal';
import { Timeout } from '@config/timeouts';
import { BasePage } from '@pages/base-page';

export class HomePage extends BasePage {
  protected readonly path = '/';
  readonly loginModal: LoginModal;
  readonly products: Locator;

  constructor(page: Page) {
    super(page);
    this.loginModal = new LoginModal(page);
    this.products = page.locator('#tbodyid .card');
  }

  /** Title link of a product card. */
  product(title: string): Locator {
    return this.products.getByRole('link', { name: title, exact: true });
  }

  async openProduct(title: string): Promise<void> {
    // The grid reflows as each product image loads, which can move a link out
    // from under a click mid-press (seen on Firefox); let it settle first.
    await expect
      .poll(
        () =>
          this.products
            .locator('img')
            .evaluateAll((images: HTMLImageElement[]) => images.length > 0 && images.every((image) => image.complete)),
        { message: 'catalog images have loaded', timeout: Timeout.SETTLE },
      )
      .toBe(true);
    await this.product(title).click();
    await this.page.waitForURL(/\/prod\.html\?idp_=/);
  }
}
