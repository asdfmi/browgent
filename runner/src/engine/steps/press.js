import { DEFAULT_SUCCESS_TIMEOUT_SEC } from '../utils.js';

export default async function handlePress({ runner, step }) {
  const locator = runner.page.locator(`xpath=${step.xpath}`);
  await locator.press(step.key, {
    delay: step.delay ? step.delay * 1000 : undefined,
    timeout: (step.timeout ?? DEFAULT_SUCCESS_TIMEOUT_SEC) * 1000,
  });
}
