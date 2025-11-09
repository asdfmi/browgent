import { DEFAULT_SUCCESS_TIMEOUT_SEC } from '../utils.js';

export default async function handleFill({ runner, step }) {
  const locator = runner.page.locator(`xpath=${step.xpath}`);
  const timeout = (step.timeout ?? DEFAULT_SUCCESS_TIMEOUT_SEC) * 1000;
  if (step.clear) {
    await locator.fill('', { timeout });
  }
  await locator.fill(step.value ?? '', { timeout });
}
