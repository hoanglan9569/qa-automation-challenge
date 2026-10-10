import { expect, type Locator, type Page } from '@playwright/test';

/** What the confirmation lists, parsed from its "Key: value" lines. */
export interface Receipt {
  id: number;
  /** USD */
  amount: number;
  card: string;
  name: string;
  /** Raw, as the site prints it (DateFormat.RECEIPT when correct). */
  date: string;
}

/** The SweetAlert "Thank you for your purchase!" dialog shown after Purchase. */
export class PurchaseConfirmation {
  readonly root: Locator;
  readonly title: Locator;
  readonly text: Locator;
  readonly ok: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('.sweet-alert');
    this.title = this.root.locator('h2');
    this.text = this.root.locator('p.lead');
    this.ok = this.root.getByRole('button', { name: 'OK' });
  }

  /** Wait for the dialog and parse its receipt. */
  async receipt(): Promise<Receipt> {
    await this.text.waitFor({ state: 'visible' });
    const text = await this.text.innerText();
    const field = (label: string): string => {
      const match = new RegExp(`^${label}:\\s*(.*)$`, 'm').exec(text);
      if (match?.[1] === undefined) throw new Error(`receipt has no "${label}:" line:\n${text}`);
      return match[1].trim();
    };
    return {
      id: Number(field('Id')),
      amount: Number(field('Amount').replace(/\s*USD$/, '')),
      card: field('Card Number'),
      name: field('Name'),
      date: field('Date'),
    };
  }

  /** Click OK; the site then navigates to index.html. */
  async confirm(): Promise<void> {
    // SweetAlert arms OK only once it adds `visible`, 500 ms after opening; a
    // click before then just closes the dialog, with no navigation (seen on CI).
    await expect(this.root, 'confirmation is ready for OK').toHaveClass(/\bvisible\b/);
    await Promise.all([this.page.waitForURL(/\/index\.html/), this.ok.click()]);
  }
}
