import { normalizeTimeoutSeconds } from '../utils.js';

export default async function handleExtractText({ runner, step }) {
  const locator = runner.page.locator(`xpath=${step.xpath}`).first();
  const timeout = normalizeTimeoutSeconds(step.timeout, 5) * 1000;
  await locator.waitFor({ state: 'attached', timeout });
  const text = (await locator.textContent())?.trim() ?? '';
  if (step.as) {
    runner.execution.setVar(step.as, text);
  }
  return text;
}
