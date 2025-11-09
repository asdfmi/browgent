import { DEFAULT_SUCCESS_TIMEOUT_SEC } from '../utils.js';

export default async function handleClick({ runner, step }) {
  const locator = runner.page.locator(`xpath=${step.xpath}`);
  const options = step.options ?? {};
  await locator.click({
    button: options.button || 'left',
    clickCount: options.clickCount,
    delay: options.delay ? options.delay * 1000 : undefined,
    timeout: (options.timeout ?? DEFAULT_SUCCESS_TIMEOUT_SEC) * 1000,
  });
}
