import { DEFAULT_SUCCESS_TIMEOUT_SEC } from '../utils.js';

export default async function handlePress({ automation, step }) {
  const {
    xpath = '',
    key = '',
    delay = null,
    timeout: timeoutSeconds = DEFAULT_SUCCESS_TIMEOUT_SEC,
  } = step.config ?? {};
  const locator = automation.page.locator(`xpath=${xpath}`);
  await locator.press(key, {
    delay: delay ? delay * 1000 : undefined,
    timeout: timeoutSeconds * 1000,
  });
}
