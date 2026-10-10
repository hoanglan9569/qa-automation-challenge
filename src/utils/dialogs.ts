import type { Dialog, Page } from '@playwright/test';

/**
 * Run `action`, accept the native alert it raises, and return the alert text.
 *
 * Accepted inside the event handler on purpose: a synchronous alert() blocks
 * the click until it is closed, so awaiting the click first would deadlock.
 */
export async function acceptAlert(page: Page, action: () => Promise<void>): Promise<string> {
  const message = new Promise<string>((resolve) => {
    page.once('dialog', (dialog) => {
      resolve(dialog.message());
      void dialog.accept();
    });
  });
  await action();
  return message;
}

/**
 * A guard for a step that expects a page action, not an alert: race its promise
 * against the real work so a validation alert fails fast with its own text
 * instead of hanging until the timeout. `dispose()` removes the listener when
 * the work wins; until then an unexpected alert is accepted and rejects.
 */
export function failOnDialog(page: Page, context: string): { readonly rejected: Promise<never>; dispose: () => void } {
  let handler!: (dialog: Dialog) => void;
  const rejected = new Promise<never>((_, reject) => {
    handler = (dialog) => {
      void dialog.accept();
      reject(new Error(`${context}: unexpected dialog "${dialog.message()}"`));
    };
    page.once('dialog', handler);
  });
  // Swallow the rejection if nobody is racing it any more, so disposing never
  // surfaces an unhandled rejection.
  rejected.catch(() => undefined);
  return { rejected, dispose: () => page.off('dialog', handler) };
}
