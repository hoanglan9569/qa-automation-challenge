import type { Page } from '@playwright/test';
import { Navbar } from '@components/navbar';

export abstract class BasePage {
  /** Path relative to BASE_URL. */
  protected abstract readonly path: string;
  readonly navbar: Navbar;

  constructor(readonly page: Page) {
    this.navbar = new Navbar(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
