import { expect, type Locator, type Page } from '@playwright/test';
import type { Credentials } from '@auth/accounts';
import { acceptAlert, failOnDialog } from '@utils/dialogs';

/** "Log in" modal. Success reloads the page; failures surface as a native alert. */
export class LoginModal {
  readonly root: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly close: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#logInModal');
    this.username = this.root.locator('#loginusername');
    this.password = this.root.locator('#loginpassword');
    this.submit = this.root.getByRole('button', { name: 'Log in' });
    this.close = this.root.getByRole('button', { name: 'Close' }).last();
  }

  async fill({ username, password }: Credentials): Promise<void> {
    // Wait for the modal's fade-in to settle before typing (see OrderModal.fill).
    await expect(this.root, 'login modal is ready for input').toBeFocused();
    await this.username.fill(username);
    await expect(this.username, 'username keeps the value it was given').toHaveValue(username);
    await this.password.fill(password);
    await expect(this.password, 'password keeps the value it was given').toHaveValue(password);
  }

  /** Submit valid credentials and wait for the reload that follows; a login alert fails fast. */
  async login(credentials: Credentials): Promise<void> {
    await this.fill(credentials);
    const guard = failOnDialog(this.page, 'login');
    try {
      await Promise.race([Promise.all([this.page.waitForEvent('load'), this.submit.click()]), guard.rejected]);
    } finally {
      guard.dispose();
    }
  }

  /** Submit and return the alert the site shows instead of logging in. */
  async loginExpectingAlert(credentials: Credentials): Promise<string> {
    await this.fill(credentials);
    return acceptAlert(this.page, () => this.submit.click());
  }
}
