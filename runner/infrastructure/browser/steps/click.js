import { DEFAULT_SUCCESS_TIMEOUT_SEC } from '../utils.js';

export default async function handleClick({ automation, step }) {
  const { xpath = '', options = {} } = step.config ?? {};
  const locator = automation.page.locator(`xpath=${xpath}`);
  await locator.click({
    button: options.button || 'left',
    clickCount: options.clickCount,
    delay: options.delay ? options.delay * 1000 : undefined,
    timeout: (options.timeout ?? DEFAULT_SUCCESS_TIMEOUT_SEC) * 1000,
  });
}
