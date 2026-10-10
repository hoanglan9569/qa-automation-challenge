import type { Locator, Page } from '@playwright/test';
import { OrderModal } from '@components/order-modal';
import { PurchaseConfirmation } from '@components/purchase-confirmation';
import { BasePage } from '@pages/base-page';

export interface CartRow {
  title: string;
  price: number;
}

/**
 * Cart table + Place Order. Rows and the total are filled in asynchronously,
 * one /view call per line, so wait on `rows`/`total` with web-first assertions
 * before reading them.
 */
export class CartPage extends BasePage {
  protected readonly path = '/cart.html';
  readonly rows: Locator;
  readonly total: Locator;
  readonly placeOrderButton: Locator;
  readonly orderModal: OrderModal;
  readonly confirmation: PurchaseConfirmation;

  constructor(page: Page) {
    super(page);
    this.rows = page.locator('#tbodyid tr');
    this.total = page.locator('#totalp');
    this.placeOrderButton = page.getByRole('button', { name: 'Place Order' });
    this.orderModal = new OrderModal(page);
    this.confirmation = new PurchaseConfirmation(page);
  }

  /** Rows whose title cell is exactly `title`. */
  row(title: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: title, exact: true }) });
  }

  /** Current table contents (title, price), in display order. */
  async items(): Promise<CartRow[]> {
    return Promise.all(
      (await this.rows.all()).map(async (row) => ({
        title: (await row.locator('td').nth(1).innerText()).trim(),
        price: Number((await row.locator('td').nth(2).innerText()).trim()),
      })),
    );
  }

  /** Delete the first row titled `title`; the site reloads the page afterwards. */
  async deleteItem(title: string): Promise<void> {
    await Promise.all([
      this.page.waitForEvent('load'),
      this.row(title).first().getByRole('link', { name: 'Delete' }).click(),
    ]);
  }

  async openPlaceOrder(): Promise<void> {
    await this.placeOrderButton.click();
    await this.orderModal.root.waitFor({ state: 'visible' });
  }
}
