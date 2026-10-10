import type { Locator, Page } from '@playwright/test';

/**
 * Top navigation bar, present on every page. DemoBlaze keeps the links visible
 * at phone widths (the hamburger is cosmetic), so no menu toggling is needed.
 */
export class Navbar {
  readonly login: Locator;
  readonly logout: Locator;
  readonly signup: Locator;
  readonly cart: Locator;
  /** "Welcome <username>", shown only when logged in. */
  readonly welcome: Locator;

  constructor(private readonly page: Page) {
    this.login = page.locator('#login2');
    this.logout = page.locator('#logout2');
    this.signup = page.locator('#signin2');
    // No #cartur on cart.html itself, so match by role.
    this.cart = page.getByRole('link', { name: 'Cart', exact: true });
    this.welcome = page.locator('#nameofuser');
  }

  async openLogin(): Promise<void> {
    await this.login.click();
  }

  async openCart(): Promise<void> {
    await this.cart.click();
    await this.page.waitForURL(/\/cart\.html/);
  }

  /** Click "Log out"; the site clears the token cookie and returns to index.html. */
  async signOut(): Promise<void> {
    await Promise.all([this.page.waitForURL(/\/index\.html/), this.logout.click()]);
  }
}
